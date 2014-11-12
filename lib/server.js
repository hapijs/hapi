// Load modules

var Events = require('events');
var Path = require('path');
var Catbox = require('catbox');
var CatboxMemory = require('catbox-memory');
var Heavy = require('heavy');
var Hoek = require('hoek');
var Inert = require('inert');
var Items = require('items');
var Connection = require('./connection');
var Handler = require('./handler');
var Methods = require('./methods');
var Plugin = require('./plugin');
var Realm = require('./realm');
var Reply = require('./reply');
var Schema = require('./schema');


// Declare internals

var internals = {
    defaults: {
        debug: { request: ['implementation'] },
        load: {
            sampleInterval: 0
        },
        files: {
            etagsCacheMaxSize: 10000                    // Maximum number of etags in the cache
        }
    }
};


exports = module.exports = internals.Server = function (options) {

    Hoek.assert(this.constructor === internals.Server, 'Server must be instantiated using new');

    options = Schema.assert('server', options || {});

    this._settings = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['app', 'plugins']);

    this._caches = {};                                                  // Cache clients
    this._handlers = {};                                                // Registered handlers
    this._methods = new Methods(this);                                  // Server methods

    this._events = new Events.EventEmitter();                           // Server-only events
    this._dependencies = [];                                            // Plugin dependencies
    this._afters = null;                                                // Plugin after() dependencies
    this._heavy = new Heavy(this._settings.load);
    this._etags = (this._settings.files.etagsCacheMaxSize ? new Inert.file.Etags(this._settings.files.etagsCacheMaxSize) : null);
    this._replier = new Reply();
    this._plugins = {};                                                 // Exposed plugin properties by name
    this._app = {};

    if (options.cache) {
        var caches = [].concat(options.cache);
        for (var i = 0, il = caches.length; i < il; ++i) {
            this._createCache(caches[i]);
        }
    }

    if (!this._caches._default) {
        this._createCache({ engine: CatboxMemory });                    // Defaults to memory-based
    }

    Plugin.call(this, this, [], '');
    Handler.register(this);
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

    var connection = new Connection(this, options);
    this.connections.push(connection);
    this.addEmitter(connection);

    if (this.connections.length === 1) {
        this._single();
    }
};


internals.Server.prototype.start = function (callback) {

    var self = this;

    callback = callback || Hoek.ignore;

    Hoek.assert(this.connections.length, 'No connections to start');

    // Assert dependencies

    for (var i = 0, il = this._dependencies.length; i < il; ++i) {
        var dependency = this._dependencies[i];
        for (var s = 0, sl = dependency.connections.length; s < sl; ++s) {
            var connection = dependency.connections[s];
            for (var d = 0, dl = dependency.deps.length; d < dl; ++d) {
                var dep = dependency.deps[d];
                Hoek.assert(connection._registrations[dep], 'Plugin', dependency.plugin, 'missing dependency', dep, 'in connection:', connection.info.uri);
            }
        }
    }

    // Start cache

    var caches = Object.keys(self._caches);
    Items.parallel(caches, function (cache, next) {

        self._caches[cache].client.start(next);
    },
    function (err) {

        if (err) {
            return callback(err);
        }

        // After hooks

        var finalize = function (err) {

            if (err) {
                return callback(err);
            }

            // Load measurements

            self._heavy.start();

            // Start connections

            Items.serial(self.connections, function (connection, next) {

                connection._start(next);
            },
            function (err) {

                self._events.emit('start');
                return callback(err);
            });
        };

        var exts = self._afters;
        if (!exts) {
            return process.nextTick(finalize);
        }

        Items.serial(exts.nodes, function (ext, next) {

            ext.func.call(null, ext.plugin, next);
        },
        function (err) {

            return finalize(err);
        });
    });
};


internals.Server.prototype.stop = function (options, callback) {

    var self = this;

    if (typeof options === 'function') {
        callback = arguments[0];
        options = {};
    }

    Items.serial(this.connections, function (connection, next) {

        connection._stop(options, next);
    },
    function (err) {

        var caches = Object.keys(self._caches);
        for (var i = 0, il = caches.length; i < il; ++i) {
            self._caches[caches[i]].client.stop();
        }

        self._events.emit('stop');
        self._heavy.stop();

        if (callback) {
            callback(err);
        }
    });
};
