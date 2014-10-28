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

    this.register = internals.register;                                 // Override plugin behavior
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

    this.servers.push(server);
    ++this.length;
    this.events.addEmitter(server);
    return server;
};


internals.register = function (plugins /*, [options], callback, skipDependencyCheck */) {

    var self = this;

    var options = (typeof arguments[1] === 'object' ? arguments[1] : {});
    var callback = (typeof arguments[1] === 'object' ? arguments[2] : arguments[1]);
    var skipDependencyCheck = (typeof arguments[1] === 'object' ? arguments[3] : arguments[2]) || null;

    Hoek.assert(typeof callback === 'function', 'A callback function is required to register a plugin');

    return this._register(plugins, options, null, function (err) {

        if (err) {
            return callback(err);
        }

        if (!skipDependencyCheck) {
            self._assertDependencies();
        }

        return callback();
    });
};


internals.Pack.prototype._assertDependencies = function () {

    for (var i = 0, il = this._dependencies.length; i < il; ++i) {
        var dependency = this._dependencies[i];
        for (var s = 0, sl = dependency.servers.length; s < sl; ++s) {
            var server = dependency.servers[s];
            for (var d = 0, dl = dependency.deps.length; d < dl; ++d) {
                var dep = dependency.deps[d];
                Hoek.assert(server._registrations[dep], 'Plugin', dependency.plugin, 'missing dependency', dep, 'in server:', server.info.uri);
            }
        }
    }
};


internals.Pack.prototype._register = function (plugins, options, parent, callback) {

    var self = this;

    /*
        var register = function (plugin, options, next) { next(); }
        register.attributes = {
            name: 'plugin',
            version: '1.1.1',
            pkg: require('../package.json'),
            multiple: false
        };

        plugin = {
            register: register,     // plugin: { register } when assigned a directly required module
            name: 'plugin',         // || register.attributes.name  || register.attributes.pkg.name
            version: '1.1.1',       // -optional- || register.attributes.version  || register.attributes.pkg.version
            multiple: false,        // -optional- || register.attributes.multiple
            options: {}             // -optional-
        };
    */

    var registrations = [];
    plugins = [].concat(plugins);
    for (var i = 0, il = plugins.length; i < il; ++i) {
        var plugin = plugins[i];
        var hint = (plugins.length > 1 ? '(' + i + ')' : '');

        Hoek.assert(typeof plugin === 'object', 'Invalid plugin object', hint);
        Hoek.assert(!!plugin.register ^ !!plugin.plugin, 'One of plugin or register required but cannot include both', hint);
        Hoek.assert(typeof plugin.register === 'function' || (plugin.plugin && typeof plugin.plugin.register === 'function'), 'Plugin register must be a function or a required plugin module', hint);

        var register = plugin.register || plugin.plugin.register;
        var attributes = register.attributes || {};

        Hoek.assert(plugin.name || attributes, 'Incompatible plugin missing register function attributes', hint);
        Hoek.assert(plugin.name || attributes.name || (attributes.pkg && attributes.pkg.name), 'Missing plugin name', hint);

        var item = {
            register: register,
            name: plugin.name || attributes.name || attributes.pkg.name,
            version: plugin.version || attributes.version || (attributes.pkg && attributes.pkg.version) || '0.0.0',
            multiple: plugin.multiple || attributes.multiple || false,
            options: plugin.options
        };

        registrations.push(item);
    }

    Items.serial(registrations, function (item, next) {

        // Setup pack interface

        var plug = (parent || self)._select(options.select, item.name, options);

        // Protect against multiple registrations

        for (var i = 0, il = plug.servers.length; i < il; ++i) {
            var server = plug.servers[i];
            Hoek.assert(item.multiple || !server._registrations[item.name], 'Plugin', item.name, 'already registered in:', server.info.uri);
            server._registrations[item.name] = item;
        }

        // Register

        item.register.call(null, plug, item.options || {}, next);
    }, callback);
};


internals.Pack.prototype.start = function (callback) {

    var self = this;

    callback = callback || Hoek.ignore;

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

            // Start servers

            Items.serial(self.servers, function (server, next) {

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

    Items.serial(this.servers, function (server, next) {

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


/*
var config1 = {
    pack: {
        cache: 'redis',
        app: {
            'app-specific': 'value'
        }
    },
    servers: [
        {
            port: 8001,
            options: {
                labels: ['api', 'nasty']
            }
        },
        {
            host: 'localhost',
            port: '$env.PORT',
            options: {
                labels: ['api', 'nice']
            }
        }
    ],
    plugins: {
        furball: {
            version: false,
            plugins: '/'
        },
        other: [
            {
                select: ['b'],
                options: {
                    version: false,
                    plugins: '/'
                }
            }
        ]
    }
};
*/

internals.Pack.compose = function (manifest /*, [options], callback */) {

    var options = arguments.length === 2 ? {} : arguments[1];
    var callback = arguments.length === 2 ? arguments[1] : arguments[2];

    // Create pack

    Hoek.assert(options, 'Invalid options');
    Hoek.assert(typeof callback === 'function', 'Invalid callback');

    Schema.assert('manifest', manifest);

    var packSettings = manifest.pack || {};
    if (packSettings.cache) {
        packSettings = Hoek.clone(packSettings);

        var caches = [];
        var config = [].concat(packSettings.cache);

        for (var i = 0, il = config.length; i < il; ++i) {
            var item = config[i];
            if (typeof item === 'string' ||
                typeof item.engine === 'string') {

                if (typeof item === 'string') {
                    item = { engine: item };
                }

                var strategy = item.engine;
                if (options.relativeTo &&
                    strategy[0] === '.') {

                    strategy = Path.join(options.relativeTo, strategy);
                }

                item.engine = require(strategy);
            }

            caches.push(item);
        }

        packSettings.cache = caches;
    }

    var pack = new internals.Pack(packSettings);

    // Load servers

    manifest.servers.forEach(function (server) {

        if (typeof server.port === 'string') {
            server.port = parseInt(server.port, 10);
        }

        pack.server(server.host, server.port, server.options);
    });

    // Load plugin

    var names = Object.keys(manifest.plugins);
    Items.serial(names, function (name, nextName) {

        var item = manifest.plugins[name];
        var path = name;
        if (options.relativeTo &&
            path[0] === '.') {

            path = Path.join(options.relativeTo, path);
        }

        /*
            simple: {
                key: 'value'
            },
            custom: [
                {
                    select: ['b'],
                    options: {
                        key: 'value'
                    }
                }
            ]
        */

        var plugins = [];
        if (Array.isArray(item)) {
            item.forEach(function (instance) {

                var registerOptions = Hoek.cloneWithShallow(instance, 'options');
                delete registerOptions.options;

                plugins.push({
                    module: {
                        plugin: require(path),
                        options: instance.options
                    },
                    apply: registerOptions
                });
            });
        }
        else {
            plugins.push({
                module: {
                    plugin: require(path),
                    options: item
                },
                apply: {}
            });
        }

        Items.serial(plugins, function (plugin, nextRegister) {


            pack.register(plugin.module, plugin.apply, nextRegister, true);
        }, nextName);
    },
    function (err) {

        if (err) {
            return callback(err);
        }

        pack._assertDependencies();
        return callback(err, pack);
    });
};
