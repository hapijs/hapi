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

var internals = {};


exports = module.exports = internals.Connection = function (host, port, options, server) {

    Events.EventEmitter.call(this);

    this.realm = new Realm(options);
    this.settings = this.realm.settings;
    this.server = server;

    // Connection properties

    this.type = (host && host.indexOf('/') !== -1 ? 'unix' : (host && host.indexOf('\\\\.\\pipe\\') === 0 ? 'windows' : 'port'));
    Hoek.assert(this.type === 'port' || port === undefined, 'Cannot specify port with a UNIX domain socket or a Windows named pipe');

    this._host = (host ? (this.type === 'unix' ? Path.resolve(host) : (this.type === 'windows' ? host : host.toLowerCase())) : '');
    this._port = (port !== undefined ? port : (this.settings.tls ? 443 : 80));

    // Connection facilities

    this._started = false;
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

    this._load = server._heavy.policy(this.settings.load);
    this._stateDefinitions = new Statehood.Definitions(this.settings.state.cookies);
    this.auth = new Auth(this);
    this._router = null;
    Router.create(this);                // Sets this._router

    this.plugins = {};                  // Registered plugin APIs by plugin name
    this.app = {};                      // Place for application-specific state without conflicts with hapi, should not be used by plugins

    // Create listener

    this.listener = (this.settings.tls ? Https.createServer(this.settings.tls, this._dispatch()) : Http.createServer(this._dispatch()));

    // Connection information

    this.info = {
        host: this._host || '0.0.0.0'
    };

    if (this.type !== 'port') {
        this.info.port = 0;
        this.info.protocol = this.type;
        this.info.uri = this.info.protocol + ':' + this._host;
    }
    else {
        this.info.port = this._port || 0;
        this.info.protocol = (this.settings.tls ? 'https' : 'http');
        if (this.info.port) {
            this.info.uri = this.info.protocol + '://' + (this._host || Os.hostname() || 'localhost') + ':' + this.info.port;
        }
    }
};

Hoek.inherits(internals.Connection, Events.EventEmitter);


internals.Connection.prototype._start = function (callback) {

    if (this._started) {
        return Hoek.nextTick(callback)();
    }

    this._started = true;

    this._init(callback);       // callback is called after this.listener.listen()

    if (this.type !== 'port') {
        this.listener.listen(this._host);
    }
    else {
        this.listener.listen(this._port, this._host);
    }
};


internals.Connection.prototype._init = function (callback) {

    var self = this;

    // Setup listener

    this._connections = {};
    var onListening = function () {

        // Update the host, port, and uri with active values

        if (self.type === 'port') {
            var address = self.listener.address();
            self.info.host = self._host || address.address || '0.0.0.0';
            self.info.port = address.port;
            self.info.uri = self.info.protocol + '://' + (self._host || Os.hostname() || 'localhost') + ':' + self.info.port;
        }

        return callback();
    };

    this.listener.once('listening', onListening);

    this._onConnection = function (connection) {

        var key = connection.remoteAddress + ':' + connection.remotePort;
        self._connections[key] = connection;

        connection.once('close', function () {

            delete self._connections[key];
        });
    };

    this.listener.on('connection', this._onConnection);

    return this.listener;
};


internals.Connection.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (!this._started) {
        return Hoek.nextTick(callback)();
    }

    this._started = false;

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            self._connections[key].destroy();
        });
    }, options.timeout);

    this.listener.close(function () {

        self.listener.removeListener('connection', self._onConnection);
        clearTimeout(timeoutId);
        callback();
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


internals.Connection.prototype.location = function (uri, request) {

    return Headers.location(uri, this, request);
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
