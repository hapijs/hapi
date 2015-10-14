// Load modules

var Events = require('events');
var Catbox = require('catbox');
var CatboxMemory = require('catbox-memory');
var Heavy = require('heavy');
var Hoek = require('hoek');
var Items = require('items');
var Mimos = require('mimos');
var Connection = require('./connection');
var Defaults = require('./defaults');
var Ext = require('./ext');
var Methods = require('./methods');
var Plugin = require('./plugin');
var Reply = require('./reply');
var Request = require('./request');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Server = function (options) {

    Hoek.assert(this instanceof internals.Server, 'Server must be instantiated using new');

    options = Schema.apply('server', options || {});

    this._settings = Hoek.applyToDefaultsWithShallow(Defaults.server, options, ['connections.routes.bind']);
    this._settings.connections = Hoek.applyToDefaultsWithShallow(Defaults.connection, this._settings.connections || {}, ['routes.bind']);
    this._settings.connections.routes.cors = Hoek.applyToDefaults(Defaults.cors, this._settings.connections.routes.cors);
    this._settings.connections.routes.security = Hoek.applyToDefaults(Defaults.security, this._settings.connections.routes.security);

    this._caches = {};                                                  // Cache clients
    this._handlers = {};                                                // Registered handlers
    this._methods = new Methods(this);                                  // Server methods

    this._events = new Events.EventEmitter();                           // Server-only events
    this._dependencies = [];                                            // Plugin dependencies
    this._registrations = {};                                           // Tracks plugins registered before connection added
    this._heavy = new Heavy(this._settings.load);
    this._mime = new Mimos(this._settings.mime);
    this._replier = new Reply();
    this._requestor = new Request();
    this._decorations = {};
    this._plugins = {};                                                 // Exposed plugin properties by name
    this._app = {};
    this._registring = false;                                           // true while register() is waiting for plugin callbacks
    this._state = 'stopped';                                            // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'

    this._extensionsSeq = 0;                                            // Used to keep absolute order of extensions based on the order added across locations
    this._extensions = {
        onPreStart: new Ext(this),
        onPostStart: new Ext(this),
        onPreStop: new Ext(this),
        onPostStop: new Ext(this)
    };

    if (options.cache) {
        var caches = [].concat(options.cache);
        for (var i = 0, il = caches.length; i < il; ++i) {
            this._createCache(caches[i]);
        }
    }

    if (!this._caches._default) {
        this._createCache({ engine: CatboxMemory });                    // Defaults to memory-based
    }

    Plugin.call(this, this, [], '', null);
};

Hoek.inherits(internals.Server, Plugin);


internals.Server.prototype._createCache = function (options) {

    if (typeof options === 'function') {
        options = { engine: options };
    }

    var name = options.name || '_default';
    Hoek.assert(!this._caches[name], 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

    var client = null;
    if (typeof options.engine === 'object') {
        client = new Catbox.Client(options.engine);
    }
    else {
        var settings = Hoek.clone(options);
        settings.partition = settings.partition || 'hapi-cache';
        delete settings.name;
        delete settings.engine;
        delete settings.shared;

        client = new Catbox.Client(options.engine, settings);
    }

    this._caches[name] = {
        client: client,
        segments: {},
        shared: options.shared || false
    };
};


internals.Server.prototype.connection = function (options) {

    var root = this.root;                                   // Explicitly use the root reference (for plugin invocation)

    var settings = Hoek.applyToDefaultsWithShallow(root._settings.connections, options || {}, ['listener', 'routes.bind']);
    settings.routes.cors = Hoek.applyToDefaults(root._settings.connections.routes.cors || Defaults.cors, settings.routes.cors) || false;
    settings.routes.security = Hoek.applyToDefaults(root._settings.connections.routes.security || Defaults.security, settings.routes.security);

    settings = Schema.apply('connection', settings);       // Applies validation changes (type cast)

    var connection = new Connection(root, settings);
    root.connections.push(connection);
    root.addEmitter(connection);
    root._single();

    var registrations = Object.keys(root._registrations);
    for (var i = 0, il = registrations.length; i < il; ++i) {
        var name = registrations[i];
        connection.registrations[name] = root._registrations[name];
    }

    return this._clone([connection]);                       // Use this for active realm
};


internals.Server.prototype.start = function (callback) {

    var self = this;

    Hoek.assert(typeof callback === 'function', 'Missing required start callback function');

    if (this._state === 'initialized') {
        return this._start(callback);
    }

    if (this._state === 'started') {
        Items.serial(this.connections, function (connectionItem, next) {

            connectionItem._start(next);
        }, callback);

        return;
    }

    if (this._state !== 'stopped') {
        return Hoek.nextTick(callback)(new Error('Cannot start server while it is in ' + this._state + ' state'));
    }

    this.initialize(function (err) {

        if (err) {
            return callback(err);
        }

        self._start(callback);
    });
};


internals.Server.prototype.initialize = function (callback) {

    var self = this;

    Hoek.assert(callback, 'Missing start callback function');

    var errorCallback = Hoek.nextTick(callback);
    if (!this.connections.length) {
        return errorCallback(new Error('No connections to start'));
    }

    if (this._registring) {
        return errorCallback(new Error('Cannot start server before plugins finished registration'));
    }

    if (this._state !== 'stopped') {
        return errorCallback(new Error('Cannot initialize server while it is in ' + this._state + ' state'));
    }

    // Assert dependencies

    for (var i = 0, il = this._dependencies.length; i < il; ++i) {
        var dependency = this._dependencies[i];
        if (dependency.connections) {
            for (var s = 0, sl = dependency.connections.length; s < sl; ++s) {
                var connection = dependency.connections[s];
                for (var d = 0, dl = dependency.deps.length; d < dl; ++d) {
                    var dep = dependency.deps[d];
                    if (!connection.registrations[dep]) {
                        return errorCallback(new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep + ' in connection: ' + connection.info.uri));
                    }
                }
            }
        }
        else {
            for (d = 0, dl = dependency.deps.length; d < dl; ++d) {
                dep = dependency.deps[d];
                if (!this._registrations[dep]) {
                    return errorCallback(new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep));
                }
            }
        }
    }

    this._state = 'initializing';

    // Start cache

    var caches = Object.keys(self._caches);
    Items.parallel(caches, function (cache, next) {

        self._caches[cache].client.start(next);
    },
    function (err) {

        if (err) {
            self._state = 'invalid';
            return callback(err);
        }

        // After hooks

        self._invoke('onPreStart', function (err) {

            if (err) {
                self._state = 'invalid';
                return callback(err);
            }

            // Load measurements

            self._heavy.start();

            // Listen to connections

            self._state = 'initialized';
            return callback();
        });
    });
};


internals.Server.prototype._start = function (callback) {

    var self = this;

    this._state = 'starting';

    Items.serial(this.connections, function (connectionItem, next) {

        connectionItem._start(next);
    },
    function (err) {

        if (err) {
            self._state = 'invalid';
            return callback(err);
        }

        self._events.emit('start');
        self._invoke('onPostStart', function (err) {

            if (err) {
                self._state = 'invalid';
                return callback(err);
            }

            self._state = 'started';
            return callback();
        });
    });
};


internals.Server.prototype.stop = function (/* [options], callback */) {

    var self = this;

    Hoek.assert(arguments.length, 'Missing required stop callback function');

    var callback = (arguments.length === 1 ? arguments[0] : arguments[1]);
    var options = (arguments.length === 1 ? {} : arguments[0]);
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    Hoek.assert(typeof callback === 'function', 'Missing required stop callback function');

    if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this._state) === -1) {
        return Hoek.nextTick(callback)(new Error('Cannot stop server while in ' + this._state + ' state'));
    }

    this._state = 'stopping';

    this._invoke('onPreStop', function (err) {

        if (err) {
            self._state = 'invalid';
            return callback(err);
        }

        Items.serial(self.connections, function (connection, next) {

            connection._stop(options, next);
        },
        function (err) {

            if (err) {
                self._state = 'invalid';
                return callback(err);
            }

            var caches = Object.keys(self._caches);
            for (var i = 0, il = caches.length; i < il; ++i) {
                self._caches[caches[i]].client.stop();
            }

            self._events.emit('stop');
            self._heavy.stop();
            self._invoke('onPostStop', function (err) {

                if (err) {
                    self._state = 'invalid';
                    return callback(err);
                }

                self._state = 'stopped';
                return callback();
            });
        });
    });
};


internals.Server.prototype._invoke = function (type, next) {

    var exts = this._extensions[type];
    if (!exts.nodes) {
        return next();
    }

    Items.serial(exts.nodes, function (ext, nextExt) {

        var bind = (ext.bind || ext.plugin.realm.settings.bind);
        ext.func.call(bind, ext.plugin._select(), nextExt);
    }, next);
};
