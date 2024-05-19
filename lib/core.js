'use strict';

const Http = require('http');
const Https = require('https');
const Os = require('os');
const Path = require('path');

const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Call = require('@hapi/call');
const Catbox = require('@hapi/catbox');
const { Engine: CatboxMemory } = require('@hapi/catbox-memory');
const { Heavy } = require('@hapi/heavy');
const Hoek = require('@hapi/hoek');
const { Mimos } = require('@hapi/mimos');
const Podium = require('@hapi/podium');
const Statehood = require('@hapi/statehood');

const Auth = require('./auth');
const Compression = require('./compression');
const Config = require('./config');
const Cors = require('./cors');
const Ext = require('./ext');
const Methods = require('./methods');
const Request = require('./request');
const Response = require('./response');
const Route = require('./route');
const Toolkit = require('./toolkit');
const Validation = require('./validation');


const internals = {
    counter: {
        min: 10000,
        max: 99999
    },
    events: [
        { name: 'cachePolicy', spread: true },
        { name: 'log', channels: ['app', 'internal'], tags: true },
        { name: 'request', channels: ['app', 'internal', 'error'], tags: true, spread: true },
        'response',
        'route',
        'start',
        'closing',
        'stop'
    ],
    badRequestResponse: Buffer.from('HTTP/1.1 400 Bad Request\r\n\r\n', 'ascii')
};


exports = module.exports = internals.Core = class {

    actives = new WeakMap();                                                   // Active requests being processed
    app = {};
    auth = new Auth(this);
    caches = new Map();                                                        // Cache clients
    compression = new Compression();
    controlled = null;                                                         // Other servers linked to the phases of this server
    dependencies = [];                                                         // Plugin dependencies
    events = new Podium.Podium(internals.events);
    heavy = null;
    info = null;
    instances = new Set();
    listener = null;
    methods = new Methods(this);                                               // Server methods
    mime = null;
    onConnection = null;                                                       // Used to remove event listener on stop
    phase = 'stopped';                                                         // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'
    plugins = {};                                                              // Exposed plugin properties by name
    registrations = {};                                                        // Tracks plugin for dependency validation { name -> { version } }
    registring = 0;                                                            // > 0 while register() is waiting for plugin callbacks
    Request = class extends Request { };
    Response = class extends Response { };
    requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    root = null;
    router = null;
    settings = null;
    sockets = null;                                                            // Track open sockets for graceful shutdown
    started = false;
    states = null;
    toolkit = new Toolkit.Manager();
    type = null;
    validator = null;

    extensionsSeq = 0;                                                         // Used to keep absolute order of extensions based on the order added across locations
    extensions = {
        server: {
            onPreStart: new Ext('onPreStart', this),
            onPostStart: new Ext('onPostStart', this),
            onPreStop: new Ext('onPreStop', this),
            onPostStop: new Ext('onPostStop', this)
        },
        route: {
            onRequest: new Ext('onRequest', this),
            onPreAuth: new Ext('onPreAuth', this),
            onCredentials: new Ext('onCredentials', this),
            onPostAuth: new Ext('onPostAuth', this),
            onPreHandler: new Ext('onPreHandler', this),
            onPostHandler: new Ext('onPostHandler', this),
            onPreResponse: new Ext('onPreResponse', this),
            onPostResponse: new Ext('onPostResponse', this)
        }
    };

    decorations = {
        handler: new Map(),
        request: new Map(),
        response: new Map(),
        server: new Map(),
        toolkit: new Map(),
        requestApply: null,
        public: { handler: [], request: [], response: [], server: [], toolkit: [] }
    };

    constructor(options) {

        const { settings, type } = internals.setup(options);

        this.settings = settings;
        this.type = type;

        this.heavy = new Heavy(this.settings.load);
        this.mime = new Mimos(this.settings.mime);
        this.router = new Call.Router(this.settings.router);
        this.states = new Statehood.Definitions(this.settings.state);

        this._debug();
        this._initializeCache();

        if (this.settings.routes.validate.validator) {
            this.validator = Validation.validator(this.settings.routes.validate.validator);
        }

        this.listener = this._createListener();
        this._initializeListener();
        this.info = this._info();
    }

    _debug() {

        const debug = this.settings.debug;
        if (!debug) {
            return;
        }

        // Subscribe to server log events

        const method = (event) => {

            const data = event.error ?? event.data;
            console.error('Debug:', event.tags.join(', '), data ? '\n    ' + (data.stack ?? (typeof data === 'object' ? Hoek.stringify(data) : data)) : '');
        };

        if (debug.log) {
            const filter = debug.log.some((tag) => tag === '*') ? undefined : debug.log;
            this.events.on({ name: 'log', filter }, method);
        }

        if (debug.request) {
            const filter = debug.request.some((tag) => tag === '*') ? undefined : debug.request;
            this.events.on({ name: 'request', filter }, (request, event) => method(event));
        }
    }

    _initializeCache() {

        if (this.settings.cache) {
            this._createCache(this.settings.cache);
        }

        if (!this.caches.has('_default')) {
            this._createCache([{ provider: CatboxMemory }]);        // Defaults to memory-based
        }
    }

    _info() {

        const now = Date.now();
        const protocol = this.type === 'tcp' ? (this.settings.tls ? 'https' : 'http') : this.type;
        const host = this.settings.host || Os.hostname() || 'localhost';
        const port = this.settings.port;

        const info = {
            created: now,
            started: 0,
            host,
            port,
            protocol,
            id: Os.hostname() + ':' + process.pid + ':' + now.toString(36),
            uri: this.settings.uri ?? (protocol + ':' + (this.type === 'tcp' ? '//' + host + (port ? ':' + port : '') : port))
        };

        return info;
    }

    _counter() {

        const next = ++this.requestCounter.value;

        if (this.requestCounter.value > this.requestCounter.max) {
            this.requestCounter.value = this.requestCounter.min;
        }

        return next - 1;
    }

    _createCache(configs) {

        Hoek.assert(this.phase !== 'initializing', 'Cannot provision server cache while server is initializing');

        configs = Config.apply('cache', configs);

        const added = [];
        for (let config of configs) {

            // <function>
            // { provider: <function> }
            // { provider: { constructor: <function>, options } }
            // { engine }

            if (typeof config === 'function') {
                config = { provider: { constructor: config } };
            }

            const name = config.name ?? '_default';
            Hoek.assert(!this.caches.has(name), 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

            let client = null;

            if (config.provider) {
                let provider = config.provider;
                if (typeof provider === 'function') {
                    provider = { constructor: provider };
                }

                client = new Catbox.Client(provider.constructor, provider.options ?? { partition: 'hapi-cache' });
            }
            else {
                client = new Catbox.Client(config.engine);
            }

            this.caches.set(name, { client, segments: {}, shared: config.shared ?? false });
            added.push(client);
        }

        return added;
    }

    registerServer(server) {

        if (!this.root) {
            this.root = server;
            this._defaultRoutes();
        }

        this.instances.add(server);
    }

    async _start() {

        if (this.phase === 'initialized' ||
            this.phase === 'started') {

            this._validateDeps();
        }

        if (this.phase === 'started') {
            return;
        }

        if (this.phase !== 'stopped' &&
            this.phase !== 'initialized') {

            throw new Error('Cannot start server while it is in ' + this.phase + ' phase');
        }

        if (this.phase !== 'initialized') {
            await this._initialize();
        }

        this.phase = 'starting';
        this.started = true;
        this.info.started = Date.now();

        try {
            await this._listen();
        }
        catch (err) {
            this.started = false;
            this.phase = 'invalid';
            throw err;
        }

        this.phase = 'started';
        this.events.emit('start');

        try {
            if (this.controlled) {
                await Promise.all(this.controlled.map((control) => control.start()));
            }

            await this._invoke('onPostStart');
        }
        catch (err) {
            this.phase = 'invalid';
            throw err;
        }
    }

    _listen() {

        return new Promise((resolve, reject) => {

            if (!this.settings.autoListen) {
                resolve();
                return;
            }

            const onError = (err) => {

                reject(err);
                return;
            };

            this.listener.once('error', onError);

            const finalize = () => {

                this.listener.removeListener('error', onError);
                resolve();
                return;
            };

            if (this.type !== 'tcp') {
                this.listener.listen(this.settings.port, finalize);
            }
            else {
                // Default is the unspecified address, :: if IPv6 is available or otherwise the IPv4 address 0.0.0.0
                const address = this.settings.address || this.settings.host || null;
                this.listener.listen(this.settings.port, address, finalize);
            }
        });
    }

    async _initialize() {

        if (this.registring) {
            throw new Error('Cannot start server before plugins finished registration');
        }

        if (this.phase === 'initialized') {
            return;
        }

        if (this.phase !== 'stopped') {
            throw new Error('Cannot initialize server while it is in ' + this.phase + ' phase');
        }

        this._validateDeps();
        this.phase = 'initializing';

        // Start cache

        try {
            const caches = [];
            this.caches.forEach((cache) => caches.push(cache.client.start()));
            await Promise.all(caches);
            await this._invoke('onPreStart');
            this.heavy.start();
            this.phase = 'initialized';

            if (this.controlled) {
                await Promise.all(this.controlled.map((control) => control.initialize()));
            }
        }
        catch (err) {
            this.phase = 'invalid';
            throw err;
        }
    }

    _validateDeps() {

        for (const { deps, plugin } of this.dependencies) {
            for (const dep in deps) {
                const version = deps[dep];
                Hoek.assert(this.registrations[dep], 'Plugin', plugin, 'missing dependency', dep);
                Hoek.assert(version === '*' || Config.versionMatch(this.registrations[dep].version, version), 'Plugin', plugin, 'requires', dep, 'version', version, 'but found', this.registrations[dep].version);
            }
        }
    }

    async _stop(options = {}) {

        options.timeout = options.timeout ?? 5000;          // Default timeout to 5 seconds

        if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this.phase) === -1) {
            throw new Error('Cannot stop server while in ' + this.phase + ' phase');
        }

        this.phase = 'stopping';

        try {
            await this._invoke('onPreStop');

            if (this.started) {
                this.started = false;
                this.info.started = 0;

                await this._unlisten(options.timeout);
            }

            const caches = [];
            this.caches.forEach((cache) => caches.push(cache.client.stop()));
            await Promise.all(caches);

            this.events.emit('stop');
            this.heavy.stop();

            if (this.controlled) {
                await Promise.all(this.controlled.map((control) => control.stop(options)));
            }

            await this._invoke('onPostStop');
            this.phase = 'stopped';
        }
        catch (err) {
            this.phase = 'invalid';
            throw err;
        }
    }

    _unlisten(timeout) {

        let timeoutId = null;
        if (this.settings.operations.cleanStop) {

            // Set connections timeout

            const destroy = () => {

                for (const connection of this.sockets) {
                    connection.destroy();
                }

                this.sockets.clear();
            };

            timeoutId = setTimeout(destroy, timeout);

            // Tell idle keep-alive connections to close

            for (const connection of this.sockets) {
                if (!this.actives.has(connection)) {
                    connection.end();
                }
            }
        }

        // Close connection

        return new Promise((resolve) => {

            this.listener.close(() => {

                if (this.settings.operations.cleanStop) {
                    this.listener.removeListener(this.settings.tls ? 'secureConnection' : 'connection', this.onConnection);
                    clearTimeout(timeoutId);
                }

                this._initializeListener();
                resolve();
            });

            this.events.emit('closing');
        });
    }

    async _invoke(type) {

        const exts = this.extensions.server[type];
        if (!exts.nodes) {
            return;
        }

        // Execute extensions

        for (const ext of exts.nodes) {
            const bind = ext.bind ?? ext.realm.settings.bind;
            const operation = ext.func.call(bind, ext.server, bind);
            await Toolkit.timed(operation, { timeout: ext.timeout, name: type });
        }
    }

    _defaultRoutes() {

        this.router.special('notFound', new Route({ method: '_special', path: '/{p*}', handler: internals.notFound }, this.root, { special: true }));
        this.router.special('badRequest', new Route({ method: '_special', path: '/{p*}', handler: internals.badRequest }, this.root, { special: true }));

        if (this.settings.routes.cors) {
            Cors.handler(this.root);
        }
    }

    _dispatch(options = {}) {

        return (req, res) => {

            // Create request

            const request = Request.generate(this.root, req, res, options);

            // Track socket request processing state

            if (this.settings.operations.cleanStop &&
                req.socket) {

                this.actives.set(req.socket, request);
                const env = { core: this, req };
                res.on('finish', internals.onFinish.bind(res, env));
            }

            // Check load

            if (this.settings.load.sampleInterval) {
                try {
                    this.heavy.check();
                }
                catch (err) {
                    Bounce.rethrow(err, 'system');
                    this._log(['load'], this.heavy.load);
                    request._reply(err);
                    return;
                }
            }

            request._execute();
        };
    }

    _createListener() {

        const listener = this.settings.listener ?? (this.settings.tls ? Https.createServer(this.settings.tls) : Http.createServer());
        listener.on('request', this._dispatch());
        listener.on('checkContinue', this._dispatch({ expectContinue: true }));

        listener.on('clientError', (err, socket) => {

            this._log(['connection', 'client', 'error'], err);

            if (socket.readable) {
                const request = this.settings.operations.cleanStop && this.actives.get(socket);
                if (request) {

                    // If a request is available, it means that the connection and parsing has progressed far enough to have created the request.

                    if (err.code === 'HPE_INVALID_METHOD') {

                        // This parser error is for a pipelined request. Schedule destroy once current request is done.

                        request.raw.res.once('close', () => {

                            if (socket.readable) {
                                socket.end(internals.badRequestResponse);
                            }
                            else {
                                socket.destroy(err);
                            }
                        });
                        return;
                    }

                    const error = Boom.badRequest();
                    error.output.headers = { connection: 'close' };
                    request._reply(error);
                }
                else {
                    socket.end(internals.badRequestResponse);
                }
            }
            else {
                socket.destroy(err);
            }
        });

        return listener;
    }

    _initializeListener() {

        this.listener.once('listening', () => {

            // Update the address, port, and uri with active values

            if (this.type === 'tcp') {
                const address = this.listener.address();
                this.info.address = address.address;
                this.info.port = address.port;
                this.info.uri = this.settings.uri ?? this.info.protocol + '://' + this.info.host + ':' + this.info.port;
            }

            if (this.settings.operations.cleanStop) {
                this.sockets = new Set();

                const self = this;
                const onClose = function () {           // 'this' is bound to the emitter

                    self.sockets.delete(this);
                };

                this.onConnection = (connection) => {

                    this.sockets.add(connection);
                    connection.on('close', onClose);
                };

                this.listener.on(this.settings.tls ? 'secureConnection' : 'connection', this.onConnection);
            }
        });
    }

    _cachePolicy(options, _segment, realm) {

        options = Config.apply('cachePolicy', options);

        const plugin = realm?.plugin;
        const segment = options.segment ?? _segment ?? (plugin ? `!${plugin}` : '');
        Hoek.assert(segment, 'Missing cache segment name');

        const cacheName = options.cache ?? '_default';
        const cache = this.caches.get(cacheName);
        Hoek.assert(cache, 'Unknown cache', cacheName);
        Hoek.assert(!cache.segments[segment] || cache.shared || options.shared, 'Cannot provision the same cache segment more than once');
        cache.segments[segment] = true;

        const policy = new Catbox.Policy(options, cache.client, segment);
        this.events.emit('cachePolicy', [policy, options.cache, segment]);

        return policy;
    }

    log(tags, data) {

        return this._log(tags, data, 'app');
    }

    _log(tags, data, channel = 'internal') {

        if (!this.events.hasListeners('log')) {
            return;
        }

        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        const timestamp = Date.now();
        const field = data instanceof Error ? 'error' : 'data';

        let event = { timestamp, tags, [field]: data, channel };

        if (typeof data === 'function') {
            event = () => ({ timestamp, tags, data: data(), channel });
        }

        this.events.emit({ name: 'log', tags, channel }, event);
    }
};


internals.setup = function (options = {}) {

    let settings = Hoek.clone(options, { shallow: ['cache', 'listener', 'routes.bind'] });
    settings.app = settings.app ?? {};
    settings.routes = Config.enable(settings.routes);
    settings = Config.apply('server', settings);

    if (settings.port === undefined) {
        settings.port = 0;
    }

    const type = (typeof settings.port === 'string' ? 'socket' : 'tcp');
    if (type === 'socket') {
        settings.port = (settings.port.indexOf('/') !== -1 ? Path.resolve(settings.port) : settings.port.toLowerCase());
    }

    if (settings.autoListen === undefined) {
        settings.autoListen = true;
    }

    Hoek.assert(settings.autoListen || !settings.port, 'Cannot specify port when autoListen is false');
    Hoek.assert(settings.autoListen || !settings.address, 'Cannot specify address when autoListen is false');

    return { settings, type };
};


internals.notFound = function () {

    throw Boom.notFound();
};


internals.badRequest = function () {

    throw Boom.badRequest();
};


internals.onFinish = function (env) {

    const { core, req } = env;

    core.actives.delete(req.socket);
    if (!core.started) {
        req.socket.end();
    }
};
