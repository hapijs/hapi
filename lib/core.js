'use strict';

// Load modules

const Http = require('http');
const Https = require('https');
const Os = require('os');
const Path = require('path');

const Boom = require('boom');
const Bounce = require('bounce');
const Call = require('call');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const Heavy = require('heavy');
const Hoek = require('hoek');
const Mimos = require('mimos');
const Podium = require('podium');
const Statehood = require('statehood');

const Auth = require('./auth');
const Compression = require('./compression');
const Config = require('./config');
const Cors = require('./cors');
const Ext = require('./ext');
const Methods = require('./methods');
const Request = require('./request');
const Route = require('./route');
const Toolkit = require('./toolkit');


// Declare internals

const internals = {
    counter: {
        min: 10000,
        max: 99999
    },
    events: [
        { name: 'log', channels: ['app', 'internal'], tags: true },
        { name: 'request', channels: ['app', 'internal', 'error'], tags: true, spread: true },
        'response',
        'route',
        'start',
        'stop'
    ],
    badRequestResponse: new Buffer('HTTP/1.1 400 Bad Request\r\n\r\n', 'ascii')
};


exports = module.exports = internals.Core = class {

    constructor(options) {

        this.root = null;                                                               // Dispatch reference of the root server

        const { settings, type } = internals.setup(options);

        this.settings = settings;
        this.type = type;

        this.auth = new Auth(this);
        this.caches = new Map();                                                        // Cache clients
        this.compression = new Compression();
        this.decorations = { handler: [], request: [], server: [], toolkit: [] };       // Public decoration names
        this.dependencies = [];                                                         // Plugin dependencies
        this.events = new Podium(internals.events);
        this.heavy = new Heavy(this.settings.load);
        this.instances = new Set();
        this.methods = new Methods(this);                                               // Server methods
        this.mime = new Mimos(this.settings.mime);
        this.registrations = {};                                                        // Tracks plugin for dependency validation { name -> { version } }
        this.onConnection = null;                                                       // Used to remove event listener on stop
        this.plugins = {};                                                              // Exposed plugin properties by name
        this.app = {};
        this.registring = 0;                                                            // > 0 while register() is waiting for plugin callbacks
        this.requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
        this.router = new Call.Router(this.settings.router);
        this.phase = 'stopped';                                                         // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'
        this.sockets = new Set();                                                       // Track open sockets for graceful shutdown
        this.started = false;
        this.states = new Statehood.Definitions(this.settings.state);
        this.toolkit = new Toolkit();

        this.extensionsSeq = 0;                                                         // Used to keep absolute order of extensions based on the order added across locations
        this.extensions = {
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
                onPreResponse: new Ext('onPreResponse', this)
            }
        };

        this._debug();
        this._decorations = { handler: {}, request: {}, server: {}, toolkit: {}, requestApply: null };
        this._initializeCache();

        this.listener = this._createListener();
        this._initializeListener();
        this.info = this._info();
    }

    _debug() {

        // Subscribe to server log events

        if (this.settings.debug) {
            const debug = (request, event) => {

                const data = event.error || event.data;
                console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Hoek.stringify(data) : data)) : ''));
            };

            if (this.settings.debug.log) {
                const filter = this.settings.debug.log.some((tag) => tag === '*') ? undefined : this.settings.debug.log;
                this.events.on({ name: 'log', filter }, (event) => debug(null, event));
            }

            if (this.settings.debug.request) {
                const filter = this.settings.debug.request.some((tag) => tag === '*') ? undefined : this.settings.debug.request;
                this.events.on({ name: 'request', filter }, debug);
            }
        }
    }

    _initializeCache() {

        if (this.settings.cache) {
            this._createCache(this.settings.cache);
        }

        if (!this.caches.has('_default')) {
            this._createCache([{ engine: CatboxMemory }]);              // Defaults to memory-based
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
            uri: this.settings.uri || (protocol + ':' + (this.type === 'tcp' ? '//' + host + (port ? ':' + port : '') : port))
        };

        return info;
    }

    _createCache(options) {

        Hoek.assert(this.phase !== 'initializing', 'Cannot provision server cache while server is initializing');

        options = Config.apply('cache', options);

        const added = [];
        for (let i = 0; i < options.length; ++i) {
            let config = options[i];
            if (typeof config === 'function') {
                config = { engine: config };
            }

            const name = config.name || '_default';
            Hoek.assert(!this.caches.has(name), 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

            let client = null;
            if (typeof config.engine === 'object') {
                client = new Catbox.Client(config.engine);
            }
            else {
                const settings = Hoek.clone(config);
                settings.partition = settings.partition || 'hapi-cache';
                delete settings.name;
                delete settings.engine;
                delete settings.shared;

                client = new Catbox.Client(config.engine, settings);
            }

            this.caches.set(name, { client, segments: {}, shared: config.shared || false });
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
            await this.events.emit('start');
            await this._invoke('onPostStart');
            this.phase = 'started';
        }
        catch (err) {
            this.started = false;
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
                const address = this.settings.address || this.settings.host || '0.0.0.0';
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
        }
        catch (err) {
            this.phase = 'invalid';
            throw err;
        }
    }

    _validateDeps() {

        for (let i = 0; i < this.dependencies.length; ++i) {
            const dependency = this.dependencies[i];
            for (let j = 0; j < dependency.deps.length; ++j) {
                const dep = dependency.deps[j];
                if (!this.registrations[dep]) {
                    throw new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep);
                }
            }
        }
    }

    async _stop(options = {}) {

        options.timeout = options.timeout || 5000;          // Default timeout to 5 seconds

        if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this.phase) === -1) {
            throw new Error('Cannot stop server while in ' + this.phase + ' phase');
        }

        this.phase = 'stopping';

        try {
            await this._invoke('onPreStop');

            if (this.started) {
                this.started = false;
                this.info.started = 0;

                await this._unlisten(options);
            }

            this.caches.forEach((cache) => cache.client.stop());
            await this.events.emit('stop');
            this.heavy.stop();
            await this._invoke('onPostStop');
            this.phase = 'stopped';
        }
        catch (err) {
            this.phase = 'invalid';
            throw err;
        }
    }

    _unlisten(options) {

        // Set connections timeout

        const timeout = () => {

            this.sockets.forEach((connection) => connection.destroy());
            this.sockets.clear();
        };

        const timeoutId = setTimeout(timeout, options.timeout);

        // Tell idle keep-alive connections to close

        this.sockets.forEach((connection) => {

            if (!connection._isHapiProcessing) {
                connection.end();
            }
        });

        // Close connection

        return new Promise((resolve) => {

            this.listener.close(() => {

                this.listener.removeListener(this.settings.tls ? 'secureConnection' : 'connection', this.onConnection);
                clearTimeout(timeoutId);

                this._initializeListener();
                resolve();
            });
        });
    }

    async _invoke(type) {

        const exts = this.extensions.server[type];
        if (!exts.nodes) {
            return;
        }

        for (let i = 0; i < exts.nodes.length; ++i) {
            const ext = exts.nodes[i];
            const bind = (ext.bind || ext.realm.settings.bind);
            await ext.func.call(bind, ext.server, bind);
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

            // Track socket request processing state

            if (req.socket) {
                req.socket._isHapiProcessing = true;
                const env = { core: this, req };
                res.on('finish', internals.onFinish.bind(res, env));
            }

            // Create request

            const request = Request.generate(this.root, req, res, options);

            // Check load

            try {
                this.heavy.check();
            }
            catch (err) {
                Bounce.rethrow(err, 'system');
                this._log(['load'], this.heavy.load);
                request._reply(err);
            }

            // Execute request lifecycle

            request._execute();
        };
    }

    _createListener() {

        const listener = this.settings.listener || (this.settings.tls ? Https.createServer(this.settings.tls) : Http.createServer());
        listener.on('request', this._dispatch());
        listener.on('checkContinue', this._dispatch({ expectContinue: true }));

        listener.on('clientError', (err, socket) => {

            this._log(['connection', 'client', 'error'], err);

            if (socket.writable) {
                socket.end(internals.badRequestResponse);
            }
            else {
                socket.destroy(err);
            }
        });

        return listener;
    }

    _initializeListener() {

        // Setup listener

        const self = this;
        const onClose = function () {           // 'this' is bound to the emitter

            self.sockets.delete(this);
        };

        this.listener.once('listening', () => {

            // Update the address, port, and uri with active values

            if (this.type === 'tcp') {
                const address = this.listener.address();
                this.info.address = address.address;
                this.info.port = address.port;
                this.info.uri = (this.settings.uri || (this.info.protocol + '://' + this.info.host + ':' + this.info.port));
            }

            this.onConnection = (connection) => {

                this.sockets.add(connection);
                connection.on('close', onClose);
            };

            this.listener.on(this.settings.tls ? 'secureConnection' : 'connection', this.onConnection);
        });
    }

    _cachePolicy(options, _segment, realm) {

        options = Config.apply('cachePolicy', options);

        const plugin = realm && realm.plugin;
        const segment = options.segment || _segment || (plugin ? `!${plugin}` : '');
        Hoek.assert(segment, 'Missing cache segment name');

        const cacheName = options.cache || '_default';
        const cache = this.caches.get(cacheName);
        Hoek.assert(cache, 'Unknown cache', cacheName);
        Hoek.assert(!cache.segments[segment] || cache.shared || options.shared, 'Cannot provision the same cache segment more than once');
        cache.segments[segment] = true;

        return new Catbox.Policy(options, cache.client, segment);
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
        const field = (data instanceof Error ? 'error' : 'data');

        let event = { timestamp, tags, [field]: data, channel };

        if (typeof data === 'function') {
            event = () => ({ timestamp, tags, data: data(), channel });
        }

        this.events.emit({ name: 'log', tags, channel }, event);
    }
};


internals.setup = function (options = {}) {

    let settings = Hoek.cloneWithShallow(options, ['listener', 'routes.bind']);
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

    req.socket._isHapiProcessing = false;
    if (!core.started) {
        req.socket.end();
    }
};
