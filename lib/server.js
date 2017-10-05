'use strict';

// Load modules

const Http = require('http');
const Https = require('https');
const Os = require('os');
const Path = require('path');

const Boom = require('boom');
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
const Cors = require('./cors');
const Defaults = require('./defaults');
const Ext = require('./ext');
const Methods = require('./methods');
const Plugin = require('./plugin');
const Responder = require('./responder');
const Request = require('./request');
const Route = require('./route');
const Schema = require('./schema');


// Declare internals

const internals = {
    counter: {
        min: 10000,
        max: 99999
    },
    events: [
        { name: 'log', tags: true },
        'start',
        'stop',
        { name: 'route', spread: true },
        { name: 'request-internal', spread: true, tags: true },
        { name: 'request', spread: true, tags: true },
        { name: 'request-error', spread: true },
        'response'
    ]
};


exports = module.exports = internals.Server = function (options) {

    Hoek.assert(this instanceof internals.Server, 'Server must be instantiated using new');

    this._setup(options);
    this._caches = {};                                                              // Cache clients
    this._handlers = {};                                                            // Registered handlers
    this._methods = new Methods(this);                                              // Server methods

    this._auth = new Auth(this);
    this._compression = new Compression();
    this._decorations = {};
    this.decorations = { request: [], responder: [], server: [] };
    this._dependencies = [];                                                        // Plugin dependencies
    this._events = new Podium(internals.events);
    this._heavy = new Heavy(this._settings.load);
    this._mime = new Mimos(this._settings.mime);
    this._registrations = {};                                                       // Tracks plugin for dependency validation { name -> { version } }
    this._responder = new Responder();
    this._requestor = new Request();
    this._plugins = {};                                                             // Exposed plugin properties by name
    this._app = {};
    this._registring = false;                                                       // true while register() is waiting for plugin callbacks
    this._requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    this._router = new Call.Router(this._settings.router);
    this._phase = 'stopped';                                                        // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'
    this._states = new Statehood.Definitions(this._settings.state);

    this._started = false;
    this._sockets = new Set();                                                      // Track open sockets for graceful shutdown
    this._onConnection = null;                                                      // Used to remove event listener on stop

    this._extensionsSeq = 0;                                                        // Used to keep absolute order of extensions based on the order added across locations
    this._extensions = {
        server: {
            onPreStart: new Ext('onPreStart', this),
            onPostStart: new Ext('onPostStart', this),
            onPreStop: new Ext('onPreStop', this),
            onPostStop: new Ext('onPostStop', this)
        },
        route: {
            onRequest: new Ext('onRequest', this),
            onPreAuth: new Ext('onPreAuth', this),
            onPostAuth: new Ext('onPostAuth', this),
            onPreHandler: new Ext('onPreHandler', this),
            onPostHandler: new Ext('onPostHandler', this),
            onPreResponse: new Ext('onPreResponse', this)
        }
    };

    if (this._settings.cache) {
        this._createCache(this._settings.cache);
    }

    if (!this._caches._default) {
        this._createCache([{ engine: CatboxMemory }]);                              // Defaults to memory-based
    }

    Plugin.call(this, this, '', null);

    this._debug();

    // Create listener

    this._listener = this._settings.listener || (this._settings.tls ? Https.createServer(this._settings.tls) : Http.createServer());
    this._listener.on('request', this._dispatch());
    this._listener.on('checkContinue', this._dispatch({ expectContinue: true }));

    this._listener.on('clientError', (err, socket) => {

        this._log(['connection', 'client', 'error'], err);
        socket.destroy(err);
    });

    this._initializeListener();

    this._events.on('route', Cors.options);

    // Connection information

    const now = Date.now();
    this._info = {
        created: now,
        started: 0,
        host: this._settings.host || Os.hostname() || 'localhost',
        port: this._settings.port,
        protocol: this.type === 'tcp' ? (this._settings.tls ? 'https' : 'http') : this.type,
        id: Os.hostname() + ':' + process.pid + ':' + now.toString(36)
    };

    this._info.uri = (this._settings.uri || (this._info.protocol + ':' + (this.type === 'tcp' ? '//' + this._info.host + (this._info.port ? ':' + this._info.port : '') : this._info.port)));

    this._defaultRoutes();

    this.info = this._info;
    this.listener = this._listener;
};

Hoek.inherits(internals.Server, Plugin);


internals.Server.prototype._setup = function (options) {

    let settings = Hoek.applyToDefaultsWithShallow(Defaults.server, options || {}, ['listener', 'routes.bind']);
    settings.routes.cors = Hoek.applyToDefaults(Defaults.cors, settings.routes.cors) || false;
    settings.routes.security = Hoek.applyToDefaults(Defaults.security, settings.routes.security);

    settings = Schema.apply('server', settings);

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

    this._settings = settings;
    this.type = type;
};


internals.Server.prototype._debug = function () {

    // Subscribe to server log events

    if (this._settings.debug) {
        const debug = (request, event) => {

            const data = event.data;
            console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Hoek.stringify(data) : data)) : ''));
        };

        if (this._settings.debug.log) {
            const filter = this._settings.debug.log.some((tag) => tag === '*') ? undefined : this._settings.debug.log;
            this._events.on({ name: 'log', filter }, (event) => debug(null, event));
        }

        if (this._settings.debug.request) {
            const filter = this._settings.debug.request.some((tag) => tag === '*') ? undefined : this._settings.debug.request;
            this._events.on({ name: 'request', filter }, debug);
            this._events.on({ name: 'request-internal', filter }, debug);
        }
    }
};


internals.Server.prototype._createCache = function (options) {

    Hoek.assert(this._phase !== 'initializing', 'Cannot provision server cache while server is initializing');

    options = Schema.apply('cache', options);

    const added = [];
    for (let i = 0; i < options.length; ++i) {
        let config = options[i];
        if (typeof config === 'function') {
            config = { engine: config };
        }

        const name = config.name || '_default';
        Hoek.assert(!this._caches[name], 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

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

        this._caches[name] = {
            client,
            segments: {},
            shared: config.shared || false
        };

        added.push(client);
    }

    return added;
};


internals.Server.prototype.start = async function () {

    if (this._phase === 'initialized' ||
        this._phase === 'started') {

        this._validateDeps();
    }

    if (this._phase === 'started') {
        return;
    }

    if (this._phase !== 'stopped' &&
        this._phase !== 'initialized') {

        throw new Error('Cannot start server while it is in ' + this._phase + ' phase');
    }

    if (this._phase !== 'initialized') {
        await this.initialize();
    }

    this._phase = 'starting';
    this._started = true;
    this._info.started = Date.now();

    try {
        await this._listen();
        await this._events.emit('start');
        await this._invoke('onPostStart');
        this._phase = 'started';
    }
    catch (err) {
        this._started = false;
        this._phase = 'invalid';
        throw err;
    }
};


internals.Server.prototype._listen = function () {

    return new Promise((resolve, reject) => {

        if (!this._settings.autoListen) {
            resolve();
            return;
        }

        const onError = (err) => {

            reject(err);
            return;
        };

        this._listener.once('error', onError);

        const finalize = () => {

            this._listener.removeListener('error', onError);
            resolve();
            return;
        };

        if (this.type !== 'tcp') {
            this._listener.listen(this._settings.port, finalize);
        }
        else {
            const address = this._settings.address || this._settings.host || '0.0.0.0';
            this._listener.listen(this._settings.port, address, finalize);
        }
    });
};


internals.Server.prototype.initialize = async function () {

    if (this._registring) {
        throw new Error('Cannot start server before plugins finished registration');
    }

    if (this._phase === 'initialized') {
        return;
    }

    if (this._phase !== 'stopped') {
        throw new Error('Cannot initialize server while it is in ' + this._phase + ' phase');
    }

    this._validateDeps();
    this._phase = 'initializing';

    // Start cache

    try {
        await Promise.all(Object.keys(this._caches).map((name) => this._caches[name].client.start()));
        await this._invoke('onPreStart');
        this._heavy.start();
        this._phase = 'initialized';
    }
    catch (err) {
        this._phase = 'invalid';
        throw err;
    }
};


internals.Server.prototype._validateDeps = function () {

    for (let i = 0; i < this._dependencies.length; ++i) {
        const dependency = this._dependencies[i];
        for (let j = 0; j < dependency.deps.length; ++j) {
            const dep = dependency.deps[j];
            if (!this._registrations[dep]) {
                throw new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep);
            }
        }
    }
};


internals.Server.prototype.stop = async function (options) {

    options = options || {};
    options.timeout = options.timeout || 5000;          // Default timeout to 5 seconds

    if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this._phase) === -1) {
        throw new Error('Cannot stop server while in ' + this._phase + ' phase');
    }

    this._phase = 'stopping';

    try {
        await this._invoke('onPreStop');

        if (this._started) {
            this._started = false;
            this._info.started = 0;

            await this._unlisten(options);
        }

        Object.keys(this._caches).forEach((name) => this._caches[name].client.stop());
        await this._events.emit('stop');
        this._heavy.stop();
        await this._invoke('onPostStop');
        this._phase = 'stopped';
    }
    catch (err) {
        this._phase = 'invalid';
        throw err;
    }
};


internals.Server.prototype._unlisten = function (options) {

    // Set connections timeout

    const timeout = () => {

        this._sockets.forEach((connection) => connection.destroy());
        this._sockets.clear();
    };

    const timeoutId = setTimeout(timeout, options.timeout);

    // Tell idle keep-alive connections to close

    this._sockets.forEach((connection) => {

        if (!connection._isHapiProcessing) {
            connection.end();
        }
    });

    // Close connection

    return new Promise((resolve) => {

        this._listener.close(() => {

            this._listener.removeListener(this._settings.tls ? 'secureConnection' : 'connection', this._onConnection);
            clearTimeout(timeoutId);

            this._initializeListener();
            resolve();
            return;
        });
    });
};


internals.Server.prototype._invoke = async function (type) {

    const exts = this._extensions.server[type];
    if (!exts.nodes) {
        return;
    }

    for (let i = 0; i < exts.nodes.length; ++i) {
        const ext = exts.nodes[i];
        const bind = (ext.bind || ext.plugin.realm.settings.bind);
        await ext.func.call(bind, ext.plugin._clone());
    }
};


internals.Server.prototype._defaultRoutes = function () {

    this._router.special('notFound', new Route({ method: '_special', path: '/{p*}', handler: internals.notFound }, this, { special: true }));
    this._router.special('badRequest', new Route({ method: '_special', path: '/{p*}', handler: internals.badRequest }, this, { special: true }));

    if (this._settings.routes.cors) {
        Cors.handler(this);
    }
};


internals.notFound = function () {

    throw Boom.notFound();
};


internals.badRequest = function () {

    throw Boom.badRequest();
};


internals.Server.prototype._dispatch = function (options) {

    options = options || {};

    return (req, res) => {

        // Track socket request processing state

        if (req.socket) {
            req.socket._isHapiProcessing = true;
            const env = { server: this, req };
            res.on('finish', internals.onFinish.bind(res, env));
        }

        // Create request

        const request = this._requestor.request(this, req, res, options);

        // Check load

        const overload = this._heavy.check();
        if (overload) {
            this._log(['load'], this.load);
            request._reply(overload);
        }
        else {

            // Execute request lifecycle

            request._execute();
        }
    };
};


internals.onFinish = function (env) {

    const { server, req } = env;

    req.socket._isHapiProcessing = false;
    if (!server._started) {
        req.socket.end();
    }
};


internals.Server.prototype._initializeListener = function () {

    // Setup listener

    const self = this;
    const onClose = function () {

        self._sockets.delete(this);
    };

    this._listener.once('listening', () => {

        // Update the address, port, and uri with active values

        if (this.type === 'tcp') {
            const address = this._listener.address();
            this._info.address = address.address;
            this._info.port = address.port;
            this._info.uri = (this._settings.uri || (this._info.protocol + '://' + this._info.host + ':' + this._info.port));
        }

        this._onConnection = (connection) => {

            this._sockets.add(connection);
            connection.on('close', onClose);
        };

        this._listener.on(this._settings.tls ? 'secureConnection' : 'connection', this._onConnection);
    });
};
