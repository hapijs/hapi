// Load modules

var Events = require('events');
var Path = require('path');
var Catbox = require('catbox');
var CatboxMemory = require('catbox-memory');
var Hoek = require('hoek');
var Items = require('items');
var Kilt = require('kilt');
var Defaults = require('./defaults');
var Handler = require('./handler');
var Methods = require('./methods');
var Plugin = require('./plugin');
var Schema = require('./schema');
var Server = require('./server');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Pack = function (options) {

    options = options || {};
    Schema.assert('pack', options);
    this._settings = {};
    this._settings.debug = Hoek.applyToDefaults(Defaults.server.debug, options.debug);

    this._caches = {};                                                  // Cache clients
    this._methods = new Methods(this);                                  // Server methods
    this._handlers = {};                                                // Registered handlers
    this._events = new Events.EventEmitter();                           // Pack-only events
    this._dependencies = [];                                            // Plugin dependencies
    this._afters = null;                                                // Plugin after() dependencies

    this.plugins = {};                                                  // Exposed plugin properties by name
    this.events = new Kilt(this._events);                               // Consolidated server events
    this.app = options.app || {};

    Plugin.call(this, this, [], '');

    if (options.cache) {
        var caches = Array.isArray(options.cache) ? options.cache : [options.cache];
        for (var i = 0, il = caches.length; i < il; ++i) {
            this._createCache(caches[i]);
        }
    }

    if (!this._caches._default) {
        this._createCache({ engine: CatboxMemory });                    // Defaults to memory-based
    }

    Handler.register(this);
};

Hoek.inherits(internals.Pack, Plugin);


internals.Pack.prototype._createCache = function (options) {

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


internals.Pack.prototype.server = function (arg1, arg2, arg3) {

    [arg1, arg2, arg3].forEach(function (arg) {                     // Server arguments can appear in any order

        if (typeof arg === 'object') {
            Hoek.assert(!arg.cache, 'Cannot configure server cache in a pack member');
        }
    });

    return this._server(new Server(arg1, arg2, arg3, this));
};


internals.Pack.prototype._server = function (server) {

    this.connections.push(server);
    ++this.length;
    this.events.addEmitter(server);
    return server;
};


internals.Pack.prototype.start = function (callback) {

    var self = this;

    callback = callback || Hoek.ignore;

    // Assert dependencies

    for (var i = 0, il = this._dependencies.length; i < il; ++i) {
        var dependency = this._dependencies[i];
        for (var s = 0, sl = dependency.connections.length; s < sl; ++s) {
            var server = dependency.connections[s];
            for (var d = 0, dl = dependency.deps.length; d < dl; ++d) {
                var dep = dependency.deps[d];
                Hoek.assert(server._registrations[dep], 'Plugin', dependency.plugin, 'missing dependency', dep, 'in server:', server.info.uri);
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

            // Start connections

            Items.serial(self.connections, function (server, next) {

                Server.prototype._start.apply(server, [next]);
            },
            function (err) {

                self._events.emit('start');
                return callback(err);
            });
        };

        var exts = self._afters;
        if (!exts) {
            return Hoek.nextTick(finalize)();
        }

        Items.serial(exts.nodes, function (ext, next) {

            ext.func.call(null, ext.plugin, next);
        },
        function (err) {

            return finalize(err);
        });
    });
};


internals.Pack.prototype.stop = function (options, callback) {

    var self = this;

    if (typeof options === 'function') {
        callback = arguments[0];
        options = {};
    }

    Items.serial(this.connections, function (server, next) {

        Server.prototype._stop.apply(server, [options, next]);
    },
    function (err) {

        self._events.emit('stop');

        if (callback) {
            callback(err);
        }
    });
};


internals.Pack.prototype._provisionCache = function (options, type, name, segment) {

    Hoek.assert(options && typeof options === 'object', 'Invalid cache policy options');
    Hoek.assert(name, 'Invalid cache policy name');
    Hoek.assert(['method', 'plugin', 'server'].indexOf(type) !== -1, 'Unknown cache policy type:', type);

    var cacheName = options.cache || '_default';
    var cache = this._caches[cacheName];
    Hoek.assert(cache, 'Unknown cache', cacheName);

    if (type === 'method') {
        Hoek.assert(!segment || segment.indexOf('##') === 0, 'Server method cache segment must start with \'##\'');
        segment = segment || '#' + name;
    }
    else if (type === 'plugin') {
        Hoek.assert(!segment || segment.indexOf('!!') === 0, 'Plugin cache segment must start with \'!!\'');
        segment = segment || '!' + name;
    }
    else {      // server
        segment = '|' + name;
    }

    Hoek.assert(cache.shared || options.shared || !cache.segments[segment], 'Cannot provision the same cache segment more than once');
    cache.segments[segment] = true;

    return new Catbox.Policy(options, cache.client, segment);
};
