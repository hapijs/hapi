'use strict';

// Load modules

const Events = require('events');
const Http = require('http');
const Https = require('https');
const Os = require('os');
const Path = require('path');
const Boom = require('boom');
const Call = require('call');
const Hoek = require('hoek');
const Shot = require('shot');
const Statehood = require('statehood');
const Auth = require('./auth');
const Cors = require('./cors');
const Ext = require('./ext');
const Promises = require('./promises');
const Route = require('./route');


// Declare internals

const internals = {
    counter: {
        min: 10000,
        max: 99999
    }
};


exports = module.exports = internals.Connection = function (server, options) {

    const now = Date.now();

    Events.EventEmitter.call(this);

    this.settings = options;                                                        // options cloned in server.connection()
    this.server = server;

    // Normalize settings

    this.settings.labels = Hoek.unique(this.settings.labels || []);                 // Remove duplicates
    if (this.settings.port === undefined) {
        this.settings.port = 0;
    }

    this.type = (typeof this.settings.port === 'string' ? 'socket' : 'tcp');
    if (this.type === 'socket') {
        this.settings.port = (this.settings.port.indexOf('/') !== -1 ? Path.resolve(this.settings.port) : this.settings.port.toLowerCase());
    }

    if (this.settings.autoListen === undefined) {
        this.settings.autoListen = true;
    }

    Hoek.assert(this.settings.autoListen || !this.settings.port, 'Cannot specify port when autoListen is false');
    Hoek.assert(this.settings.autoListen || !this.settings.address, 'Cannot specify address when autoListen is false');

    // Connection facilities

    this._started = false;
    this._connections = {};
    this._onConnection = null;          // Used to remove event listener on stop
    this.registrations = {};            // Tracks plugin for dependency validation { name -> { version } }

    this._extensions = {
        onRequest: new Ext(this.server),
        onPreAuth: new Ext(this.server),
        onPostAuth: new Ext(this.server),
        onPreHandler: new Ext(this.server),
        onPostHandler: new Ext(this.server),
        onPreResponse: new Ext(this.server)
    };

    this._requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    this._load = server._heavy.policy(this.settings.load);
    this.states = new Statehood.Definitions(this.settings.state);
    this.auth = new Auth(this);
    this._router = new Call.Router(this.settings.router);
    this._defaultRoutes();

    this.plugins = {};                  // Registered plugin APIs by plugin name
    this.app = {};                      // Place for application-specific state without conflicts with hapi, should not be used by plugins

    // Create listener

    this.listener = this.settings.listener || (this.settings.tls ? Https.createServer(this.settings.tls) : Http.createServer());
    this.listener.on('request', this._dispatch());
    this._init();

    this.listener.on('clientError', (err, socket) => {

        this.server._log(['connection', 'client', 'error'], err);
    });

    // Connection information

    this.info = {
        created: now,
        started: 0,
        host: this.settings.host || Os.hostname() || 'localhost',
        port: this.settings.port,
        protocol: this.type === 'tcp' ? (this.settings.tls ? 'https' : 'http') : this.type,
        id: Os.hostname() + ':' + process.pid + ':' + now.toString(36)
    };

    this.info.uri = (this.settings.uri || (this.info.protocol + ':' + (this.type === 'tcp' ? '//' + this.info.host + (this.info.port ? ':' + this.info.port : '') : this.info.port)));

    this.on('route', Cors.options);
};

Hoek.inherits(internals.Connection, Events.EventEmitter);


internals.Connection.prototype._init = function () {

    // Setup listener

    this.listener.once('listening', () => {

        // Update the address, port, and uri with active values

        if (this.type === 'tcp') {
            const address = this.listener.address();
            this.info.address = address.address;
            this.info.port = address.port;
            this.info.uri = (this.settings.uri || (this.info.protocol + '://' + this.info.host + ':' + this.info.port));
        }

        this._onConnection = (connection) => {

            const key = connection.remoteAddress + ':' + connection.remotePort;
            this._connections[key] = connection;

            connection.once('close', () => {

                delete this._connections[key];
            });
        };

        this.listener.on('connection', this._onConnection);
    });
};


internals.Connection.prototype._start = function (callback) {

    if (this._started) {
        return process.nextTick(callback);
    }

    this._started = true;
    this.info.started = Date.now();

    if (!this.settings.autoListen) {
        return process.nextTick(callback);
    }

    const onError = (err) => {

        this._started = false;
        return callback(err);
    };

    this.listener.once('error', onError);

    const finalize = () => {

        this.listener.removeListener('error', onError);
        callback();
    };

    if (this.type !== 'tcp') {
        this.listener.listen(this.settings.port, finalize);
    }
    else {
        const address = this.settings.address || this.settings.host || '0.0.0.0';
        this.listener.listen(this.settings.port, address, finalize);
    }
};


internals.Connection.prototype._stop = function (options, callback) {

    if (!this._started) {
        return process.nextTick(callback);
    }

    this._started = false;
    this.info.started = 0;

    const timeoutId = setTimeout(() => {

        Object.keys(this._connections).forEach((key) => {

            this._connections[key].destroy();
        });


        this._connections = {};
    }, options.timeout);

    this.listener.close(() => {

        this.listener.removeListener('connection', this._onConnection);
        clearTimeout(timeoutId);

        this._init();
        return callback();
    });
};


internals.Connection.prototype._dispatch = function (options) {

    options = options || {};

    return (req, res) => {

        if (!this._started &&
            !Shot.isInjection(req)) {

            return req.connection.end();
        }

        // Create request

        const request = this.server._requestor.request(this, req, res, options);

        // Check load

        const overload = this._load.check();
        if (overload) {
            this.server._log(['load'], this.server.load);
            request._reply(overload);
        }
        else {

            // Execute request lifecycle

            request._protect.enter(() => {

                request._execute();
            });
        }
    };
};


internals.Connection.prototype.inject = function (options, callback) {

    if (!callback) {
        return Promises.wrap(this, this.inject, [options]);
    }

    let settings = options;
    if (typeof settings === 'string') {
        settings = { url: settings };
    }

    if (!settings.authority ||
        settings.credentials ||
        settings.app ||
        settings.plugins ||
        settings.allowInternals !== undefined) {        // Can be false

        settings = Hoek.shallow(settings);              // options can be reused
        delete settings.credentials;
        delete settings.artifacts;                      // Cannot appear without credentials
        delete settings.app;
        delete settings.plugins;
        delete settings.allowInternals;

        settings.authority = settings.authority || (this.info.host + ':' + this.info.port);
    }

    const needle = this._dispatch({
        credentials: options.credentials,
        artifacts: options.artifacts,
        allowInternals: options.allowInternals,
        app: options.app,
        plugins: options.plugins
    });

    Shot.inject(needle, settings, (res) => {

        if (res.raw.res._hapi) {
            res.result = res.raw.res._hapi.result;
            res.request = res.raw.res._hapi.request;
            delete res.raw.res._hapi;
        }

        if (res.result === undefined) {
            res.result = res.payload;
        }

        return callback(res);
    });
};


internals.Connection.prototype.table = function (host) {

    return this._router.table(host);
};


internals.Connection.prototype.lookup = function (id) {

    Hoek.assert(id && typeof id === 'string', 'Invalid route id:', id);

    const record = this._router.ids[id];
    if (!record) {
        return null;
    }

    return record.route.public;
};


internals.Connection.prototype.match = function (method, path, host) {

    Hoek.assert(method && typeof method === 'string', 'Invalid method:', method);
    Hoek.assert(path && typeof path === 'string' && path[0] === '/', 'Invalid path:', path);
    Hoek.assert(!host || typeof host === 'string', 'Invalid host:', host);

    const match = this._router.route(method.toLowerCase(), path, host);
    Hoek.assert(match !== this._router.specials.badRequest, 'Invalid path:', path);
    if (match === this._router.specials.notFound) {
        return null;
    }

    return match.route.public;
};


internals.Connection.prototype._ext = function (event) {

    const type = event.type;
    Hoek.assert(this._extensions[type], 'Unknown event type', type);
    this._extensions[type].add(event);
};


internals.Connection.prototype._route = function (configs, plugin) {

    configs = [].concat(configs);
    for (let i = 0; i < configs.length; ++i) {
        const config = configs[i];

        if (Array.isArray(config.method)) {
            for (let j = 0; j < config.method.length; ++j) {
                const method = config.method[j];

                const settings = Hoek.shallow(config);
                settings.method = method;
                this._addRoute(settings, plugin);
            }
        }
        else {
            this._addRoute(config, plugin);
        }
    }
};


internals.Connection.prototype._addRoute = function (config, plugin) {

    const route = new Route(config, this, plugin);                // Do no use config beyond this point, use route members
    const vhosts = [].concat(route.settings.vhost || '*');

    for (let i = 0; i < vhosts.length; ++i) {
        const vhost = vhosts[i];
        const record = this._router.add({ method: route.method, path: route.path, vhost: vhost, analysis: route._analysis, id: route.settings.id }, route);
        route.fingerprint = record.fingerprint;
        route.params = record.params;
    }

    this.emit('route', route.public, this, plugin);
};


internals.Connection.prototype._defaultRoutes = function () {

    this._router.special('notFound', new Route({ method: '_special', path: '/{p*}', handler: internals.notFound }, this, this.server, { special: true }));
    this._router.special('badRequest', new Route({ method: '_special', path: '/{p*}', handler: internals.badRequest }, this, this.server, { special: true }));

    if (this.settings.routes.cors) {
        Cors.handler(this);
    }
};


internals.notFound = function (request, reply) {

    return reply(Boom.notFound());
};


internals.badRequest = function (request, reply) {

    return reply(Boom.badRequest());
};
