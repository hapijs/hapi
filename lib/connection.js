// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Path = require('path');
var Boom = require('boom');
var Hoek = require('hoek');
var Shot = require('shot');
var Statehood = require('statehood');
var Topo = require('topo');
var Auth = require('./auth');
var Headers = require('./response/headers');
var Realm = require('./realm');
var Request = require('./request');
var Router = require('./router');
var Schema = require('./schema');
var Utils = require('./utils');


// Declare internals

var internals = {
    counter: {
        min: 10000,
        max: 99999
    }
};


exports = module.exports = internals.Connection = function (server, options) {

    var now = Date.now();

    Events.EventEmitter.call(this);

    this._realm = new Realm(options);
    this.settings = this._realm.settings;
    this.server = server;

    // Connection properties

    this._port = this.settings.port;
    this.type = (typeof this._port === 'string' ? 'socket' : 'tcp');
    if (this.type === 'socket') {
        this._port = (this._port.indexOf('/') !== -1 ? Path.resolve(this._port) : this._port.toLowerCase());
    }

    // Connection facilities

    this._started = false;
    this._connections = {};
    this._onConnection = null;          // Used to remove event listener on stop
    this._registrations = {};           // Tracks plugin for dependency validation

    this._extensions = {
        onRequest: null,            // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreAuth: null,            // After cookie parse and before authentication (skipped if state error)
        onPostAuth: null,           // After authentication (and payload processing) and before validation (skipped if auth or payload error)
        onPreHandler: null,         // After validation and body parsing, before route handler (skipped if auth or validation error)
        onPostHandler: null,        // After route handler returns, before sending response (skipped if onPreHandler not called)
        onPreResponse: null         // Before response is sent (always called)
    };

    this._requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    this._load = server._heavy.policy(this.settings.load);
    this._stateDefinitions = new Statehood.Definitions(this.settings.state.cookies);
    this.auth = new Auth(this);
    this._router = null;
    Router.create(this);                // Sets this._router

    this.plugins = {};                  // Registered plugin APIs by plugin name
    this.app = {};                      // Place for application-specific state without conflicts with hapi, should not be used by plugins

    // Create listener

    this.listener = this.settings.listener || (this.settings.tls ? Https.createServer(this.settings.tls) : Http.createServer());
    this.listener.on('request', this._dispatch());
    this._init();

    // Connection information

    this.info = {
        created: now,
        started: 0,
        host: this._hostname(),
        port: this._port,
        protocol: this.type === 'tcp' ? (this.settings.tls ? 'https' : 'http') : this.type
    };

    this.info.uri = this.info.protocol + ':' + (this.type === 'tcp' ? '//' + this.info.host + ':' + this.info.port : this.info.port);
    this.info.id = Os.hostname() + ':' + process.pid + ':' + now.toString(36);
};

Hoek.inherits(internals.Connection, Events.EventEmitter);


internals.Connection.prototype._init = function () {

    var self = this;

    // Setup listener

    this.listener.once('listening', function () {

        // Update the host, port, and uri with active values

        if (self.type === 'tcp') {
            var address = self.listener.address();
            self.info.host = self._hostname(address.address);
            self.info.port = address.port;
            self.info.uri = self.info.protocol + '://' + self.info.host + ':' + self.info.port;
        }
    });

    this._connections = {};
    this._onConnection = function (connection) {

        var key = connection.remoteAddress + ':' + connection.remotePort;
        self._connections[key] = connection;

        connection.once('close', function () {

            delete self._connections[key];
        });
    };

    this.listener.on('connection', this._onConnection);
};


internals.Connection.prototype._hostname = function (address) {

    return this.settings.host || address || Os.hostname() || 'localhost';
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

    if (this.type !== 'tcp' ||
        !this.settings.host) {

        this.listener.listen(this._port, callback);
    }
    else {
        this.listener.listen(this._port, this.settings.host, callback);
    }
};


internals.Connection.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (!this._started) {
        return process.nextTick(callback);
    }

    this._started = false;
    this.info.started = 0;

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            self._connections[key].destroy();
        });
    }, options.timeout);

    this.listener.close(function () {

        self.listener.removeListener('connection', self._onConnection);
        clearTimeout(timeoutId);

        self._init();
        return callback();
    });
};


internals.Connection.prototype._dispatch = function (options) {

    var self = this;

    options = options || {};

    return function (req, res) {

        // Create request

        var request = new Request(self, req, res, options);

        // Check load

        if (!self._load.check()) {
            self.server.log(['hapi', 'load'], self.server.load);
            request._reply(Boom.serverTimeout('Server under heavy load', self.server.load));
        }
        else {

            // Execute request lifecycle

            request._protect.domain.run(function () {

                request._execute();
            });
        }
    };
};


internals.Connection.prototype.inject = function (options, callback) {

    var settings = options;
    if (settings.credentials) {
        settings = Utils.shallow(options);              // options can be reused
        delete settings.credentials;
    }

    var needle = this._dispatch({ credentials: options.credentials });
    Shot.inject(needle, settings, function (res) {

        if (res.raw.res._hapi) {
            res.result = res.raw.res._hapi.result;
            delete res.raw.res._hapi;
        }
        else {
            res.result = res.payload;
        }

        return callback(res);
    });
};


internals.Connection.prototype.table = function (host) {

    return this._router.table(host);
};


internals.Connection.prototype._ext = function (event, func, options, env) {

    options = options || {};

    Hoek.assert(this._extensions[event] !== undefined, 'Unknown event type', event);

    var settings = {
        before: options.before,
        after: options.after,
        group: env.plugin
    };

    var nodes = [];
    ([].concat(func)).forEach(function (fn, i) {

        var node = {
            func: fn,               // function (request, next) { next(); }
            env: env,
            bind: options.bind
        };

        nodes.push(node);
    });

    this._extensions[event] = this._extensions[event] || new Topo();
    this._extensions[event].add(nodes, settings);
};


internals.Connection.prototype._route = function (configs, env) {

    Router.add(this, configs, env);
};


internals.Connection.prototype._state = function (name, options) {

    Schema.assert('state', options, name);
    this._stateDefinitions.add(name, options);
};
