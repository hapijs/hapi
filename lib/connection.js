// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Path = require('path');
var Boom = require('boom');
var Heavy = require('heavy');
var Hoek = require('hoek');
var Inert = require('inert');
var Shot = require('shot');
var Statehood = require('statehood');
var Auth = require('./auth');
var Ext = require('./ext');
var Realm = require('./realm');
var Headers = require('./response/headers');
var Request = require('./request');
var Route = require('./route');
var Router = require('./router');
var Schema = require('./schema');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Connection = function (host, port, options, pack) {

    // Register as event emitter

    Events.EventEmitter.call(this);

    this.realm = new Realm(options);
    this.settings = this.realm.settings;

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
    this.auth = new Auth(this);
    this._ext = new Ext();
    this._etags = (this.settings.files.etagsCacheMaxSize ? new Inert.file.Etags(this.settings.files.etagsCacheMaxSize) : null);
    this._router = null;
    Router.create(this);        // Sets this._router

    this._heavy = new Heavy(this.settings.load);
    this.load = this._heavy.load;
    this._stateDefinitions = new Statehood.Definitions(this.settings.state.cookies);
    this._registrations = {};
    this.pack = pack._clone(this);

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.methods = this.pack._core._methods.methods;        // Method functions

    // Create server

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

        if (!self._heavy.check()) {
            self.log(['hapi', 'load'], self.load);
            request._reply(Boom.serverTimeout('Server under heavy load', self.load));
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

    // Load measurements

    this._heavy.start();

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
    this._heavy.stop();

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


internals.Connection.prototype.ext = function (event, func, options) {

    return this._ext.add(event, func, options, this.pack._env);
};


internals.Connection.prototype._ext = function () {

    return this._ext.add.apply(this._ext, arguments);
};


internals.Connection.prototype.route = function (configs) {

    this._route(configs);
};


internals.Connection.prototype._route = function (configs, env) {

    Router.add(this, configs, env);
};


internals.Connection.prototype.state = function (name, options) {

    Schema.assert('state', options, name);
    this._stateDefinitions.add(name, options);
};


internals.Connection.prototype.start = function (callback) {

    return this.pack.start(callback);
};


internals.Connection.prototype.stop = function (options, callback) {

    return this.pack.stop(options, callback);
};


internals.Connection.prototype.log = function (tags, data, timestamp) {

    return this.pack.log(tags, data, timestamp, this);
};


internals.Connection.prototype.views = function (options) {

    return this.pack.views(options);
};


internals.Connection.prototype.render = function (template, context, options, callback) {

    return this.pack.render(template, context, options, callback);
};


internals.Connection.prototype.cache = function (name, options) {

    return this.pack.cache(name, options);
};


internals.Connection.prototype.method = function (name, method, options) {

    return this.pack.method(name, method, options);
};


internals.Connection.prototype.handler = function (name, method) {

    return this.pack.handler(name, method);
};
