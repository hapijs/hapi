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
var Auth = require('./auth');
var Ext = require('./ext');
var Headers = require('./response/headers');
var Realm = require('./realm');
var Request = require('./request');
var Route = require('./route');
var Router = require('./router');
var Schema = require('./schema');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Connection = function (host, port, options, server) {

    // Register as event emitter

    Events.EventEmitter.call(this);

    this.realm = new Realm(options);
    this.settings = this.realm.settings;
    this.server = server;

    // Set basic configuration

    this._unixDomainSocket = (host && host.indexOf('/') !== -1);
    this._windowsNamedPipe = (host && host.indexOf('\\\\.\\pipe\\') === 0);
    Hoek.assert(!this._unixDomainSocket || port === undefined, 'Cannot specify port with a UNIX domain socket');
    Hoek.assert(!this._windowsNamedPipe || port === undefined, 'Cannot specify port with a Windows named pipe');
    this._host = (host ? (this._unixDomainSocket ? Path.resolve(host) : (this._windowsNamedPipe ? host : host.toLowerCase())) : '');
    this._port = (port !== undefined ? port : (this.settings.tls ? 443 : 80));
    this._onConnection = null;          // Used to remove event listener on stop

    // Connection facilities

    this._started = false;
    this._ext = new Ext();
    this.auth = new Auth(this);
    this._router = null;
    Router.create(this);        // Sets this._router

    this._stateDefinitions = new Statehood.Definitions(this.settings.state.cookies);
    this._registrations = {};

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.methods = server._core._methods.methods;           // Method functions

    this._load = server._core._heavy.policy(this.settings.load);

    // Create listener

    this.listener = (this.settings.tls ? Https.createServer(this.settings.tls, this._dispatch()) : Http.createServer(this._dispatch()));

    // Connection information

    this.info = {
        host: this._host || '0.0.0.0'
    };

    if (this._unixDomainSocket ||
        this._windowsNamedPipe) {

        this.info.port = 0;
        this.info.protocol = (this._unixDomainSocket ? 'unix' : 'windows');
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


internals.Connection.prototype._start = function (callback) {

    if (this._started) {
        return Hoek.nextTick(callback)();
    }

    this._started = true;

    this._init(callback);       // callback is called after this.listener.listen()

    if (this._unixDomainSocket ||
        this._windowsNamedPipe) {

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

        if (!self._unixDomainSocket ||
            !self._windowsNamedPipe) {

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


internals.Connection.prototype._ext = function (event, func, options, env) {

    return this._ext.add(event, func, options, env);
};


internals.Connection.prototype._route = function (configs, env) {

    Router.add(this, configs, env);
};


internals.Connection.prototype.state = function (name, options) {

    Schema.assert('state', options, name);
    this._stateDefinitions.add(name, options);
};


internals.Connection.prototype.table = function (host) {

    return this._router.table(host);
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


internals.Connection.prototype.location = function (uri, request) {

    return Headers.location(uri, this, request);
};
