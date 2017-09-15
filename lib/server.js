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
const Items = require('items');
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
const Promises = require('./promises');
const Reply = require('./reply');
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
    this.decorations = { request: [], reply: [], server: [] };
    this._dependencies = [];                                                        // Plugin dependencies
    this._events = new Podium(internals.events);
    this._heavy = new Heavy(this._settings.load);
    this._mime = new Mimos(this._settings.mime);
    this._registrations = {};                                                       // Tracks plugin for dependency validation { name -> { version } }
    this._replier = new Reply();
    this._requestor = new Request();
    this._plugins = {};                                                             // Exposed plugin properties by name
    this._app = {};
    this._registring = false;                                                       // true while register() is waiting for plugin callbacks
    this._requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    this._router = new Call.Router(this._settings.router);
    this._phase = 'stopped';                                                        // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'
    this._states = new Statehood.Definitions(this._settings.state);

    this._started = false;
    this._sockets = {};                 // Track open sockets for graceful shutdown
    this._onConnection = null;          // Used to remove event listener on stop

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


internals.Server.prototype._createCache = function (options, _callback) {

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

    if (!_callback) {
        return;
    }

    // Start cache

    if (['initialized', 'starting', 'started'].indexOf(this._phase) !== -1) {
        const each = (client, next) => client.start(next);
        return Items.parallel(added, each, _callback);
    }

    return Hoek.nextTick(_callback)();
};


internals.Server.prototype.start = function (callback) {

    if (!callback) {
        return Promises.wrap(this, this.start);
    }

    Hoek.assert(typeof callback === 'function', 'Missing required start callback function');
    const nextTickCallback = Hoek.nextTick(callback);

    if (this._phase === 'initialized' ||
        this._phase === 'started') {

        const error = this._validateDeps();
        if (error) {
            return nextTickCallback(error);
        }
    }

    if (this._phase === 'initialized') {
        return this._start(callback);
    }

    if (this._phase === 'started') {
        return nextTickCallback();
    }

    if (this._phase !== 'stopped') {
        return nextTickCallback(new Error('Cannot start server while it is in ' + this._phase + ' phase'));
    }

    this.initialize((err) => {

        if (err) {
            return callback(err);
        }

        this._start(callback);
    });
};


internals.Server.prototype._start = function (callback) {

    this._phase = 'starting';

    const next = (err) => {

        if (err) {
            this._phase = 'invalid';
            return Hoek.nextTick(callback)(err);
        }

        this._events.emit('start', null, () => {

            this._invoke('onPostStart', (err) => {

                if (err) {
                    this._phase = 'invalid';
                    return callback(err);
                }

                this._phase = 'started';
                return callback();
            });
        });
    };

    this._started = true;
    this._info.started = Date.now();

    if (!this._settings.autoListen) {
        return process.nextTick(next);
    }

    const onError = (err) => {

        this._started = false;
        return next(err);
    };

    this._listener.once('error', onError);

    const finalize = () => {

        this._listener.removeListener('error', onError);
        next();
    };

    if (this.type !== 'tcp') {
        this._listener.listen(this._settings.port, finalize);
    }
    else {
        const address = this._settings.address || this._settings.host || '0.0.0.0';
        this._listener.listen(this._settings.port, address, finalize);
    }
};


internals.Server.prototype.initialize = function (callback) {

    if (!callback) {
        return Promises.wrap(this, this.initialize);
    }

    Hoek.assert(typeof callback === 'function', 'Missing required start callback function');
    const nextTickCallback = Hoek.nextTick(callback);

    if (this._registring) {
        return nextTickCallback(new Error('Cannot start server before plugins finished registration'));
    }

    if (this._phase === 'initialized') {
        return nextTickCallback();
    }

    if (this._phase !== 'stopped') {
        return nextTickCallback(new Error('Cannot initialize server while it is in ' + this._phase + ' phase'));
    }

    const error = this._validateDeps();
    if (error) {
        return nextTickCallback(error);
    }

    this._phase = 'initializing';

    // Start cache

    const caches = Object.keys(this._caches);
    const each = (cache, next) => this._caches[cache].client.start(next);
    Items.parallel(caches, each, (err) => {

        if (err) {
            this._phase = 'invalid';
            return callback(err);
        }

        // After hooks

        this._invoke('onPreStart', (err) => {

            if (err) {
                this._phase = 'invalid';
                return callback(err);
            }

            // Load measurements

            this._heavy.start();

            // Listen to connection

            this._phase = 'initialized';
            return callback();
        });
    });
};


internals.Server.prototype._validateDeps = function () {

    for (let i = 0; i < this._dependencies.length; ++i) {
        const dependency = this._dependencies[i];
        for (let j = 0; j < dependency.deps.length; ++j) {
            const dep = dependency.deps[j];
            if (!this._registrations[dep]) {
                return new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep);
            }
        }
    }

    return null;
};


internals.Server.prototype.stop = function (/* [options], callback */) {

    const args = arguments.length;
    const lastArg = arguments[args - 1];
    const callback = (!args ? null : (typeof lastArg === 'function' ? lastArg : null));
    const options = (!args ? {} : (args === 1 ? (callback ? {} : arguments[0]) : arguments[0]));

    if (!callback) {
        return Promises.wrap(this, this.stop, [options]);
    }

    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this._phase) === -1) {
        return Hoek.nextTick(callback)(new Error('Cannot stop server while in ' + this._phase + ' phase'));
    }

    this._phase = 'stopping';

    this._invoke('onPreStop', (err) => {

        if (err) {
            this._phase = 'invalid';
            return callback(err);
        }

        const next = (err) => {

            if (err) {
                this._phase = 'invalid';
                return callback(err);
            }

            const caches = Object.keys(this._caches);
            for (let i = 0; i < caches.length; ++i) {
                this._caches[caches[i]].client.stop();
            }

            this._events.emit('stop', null, () => {

                this._heavy.stop();
                this._invoke('onPostStop', (err) => {

                    if (err) {
                        this._phase = 'invalid';
                        return callback(err);
                    }

                    this._phase = 'stopped';
                    return callback();
                });
            });
        };

        if (!this._started) {
            return process.nextTick(next);
        }

        this._started = false;
        this._info.started = 0;

        const timeoutId = setTimeout(() => {

            Object.keys(this._sockets).forEach((key) => {

                this._sockets[key].destroy();
            });


            this._sockets = {};
        }, options.timeout);

        this._listener.close(() => {

            this._listener.removeListener(this._settings.tls ? 'secureConnection' : 'connection', this._onConnection);
            clearTimeout(timeoutId);

            this._initializeListener();
            return next();
        });

        // Tell idle keep-alive connections to close

        Object.keys(this._sockets).forEach((key) => {

            const connection = this._sockets[key];
            if (!connection._isHapiProcessing) {
                connection.end();
            }
        });
    });
};


internals.Server.prototype._invoke = function (type, next) {

    const exts = this._extensions.server[type];
    if (!exts.nodes) {
        return next();
    }

    Items.serial(exts.nodes, (ext, nextExt) => {

        const bind = (ext.bind || ext.plugin.realm.settings.bind);
        ext.func.call(bind, ext.plugin._clone(), nextExt);
    }, next);
};


internals.Server.prototype._defaultRoutes = function () {

    this._router.special('notFound', new Route({ method: '_special', path: '/{p*}', handler: internals.notFound }, this, { special: true }));
    this._router.special('badRequest', new Route({ method: '_special', path: '/{p*}', handler: internals.badRequest }, this, { special: true }));

    if (this._settings.routes.cors) {
        Cors.handler(this);
    }
};


internals.notFound = function (request, reply) {

    return reply(Boom.notFound());
};


internals.badRequest = function (request, reply) {

    return reply(Boom.badRequest());
};


internals.Server.prototype._dispatch = function (options) {

    options = options || {};

    return (req, res) => {

        // Track socket request processing state

        if (req.socket) {
            req.socket._isHapiProcessing = true;
            res.on('finish', () => {

                req.socket._isHapiProcessing = false;
                if (!this._started) {
                    req.socket.end();
                }
            });
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


internals.Server.prototype._initializeListener = function () {

    // Setup listener

    this._listener.once('listening', () => {

        // Update the address, port, and uri with active values

        if (this.type === 'tcp') {
            const address = this._listener.address();
            this._info.address = address.address;
            this._info.port = address.port;
            this._info.uri = (this._settings.uri || (this._info.protocol + '://' + this._info.host + ':' + this._info.port));
        }

        this._onConnection = (connection) => {

            const key = connection.remoteAddress + ':' + connection.remotePort;
            this._sockets[key] = connection;

            connection.once('close', () => {

                delete this._sockets[key];
            });
        };

        this._listener.on(this._settings.tls ? 'secureConnection' : 'connection', this._onConnection);
    });
};
