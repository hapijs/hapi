// Load modules

var Path = require('path');
var Async = require('async');
var Catbox = require('catbox');
var Hoek = require('hoek');
var Kilt = require('kilt');
var Server = require('./server');
var Views = require('./views');
var Defaults = require('./defaults');
var Ext = require('./ext');
var Methods = require('./methods');
var Handler = require('./handler');
var Schema = require('./schema');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Pack = function (options) {

    options = options || {};

    this._settings = {};
    this._settings.debug = Hoek.applyToDefaults(Defaults.server.debug, options.debug);

    this._servers = [];                                                 // List of all pack server members
    this._byLabel = {};                                                 // Server [ids] organized by labels
    this._byId = {};                                                    // Servers indexed by id
    this._env = {};                                                     // Plugin-specific environment (e.g. views manager)
    this._caches = {};                                                  // Cache clients
    this._methods = new Methods(this);                                  // Server methods
    this._handlers = {};                                                // Registered handlers

    this.list = {};                                                     // Loaded plugins by name
    this.plugins = {};                                                  // Exposed plugin properties by name
    this.events = new Kilt();                                           // Consolidated subscription to all servers
    this.app = options.app || {};

    if (options.cache) {
        var caches = Array.isArray(options.cache) ? options.cache : [options.cache];
        for (var i = 0, il = caches.length; i < il; ++i) {
            this._createCache(caches[i]);
        }
    }

    if (!this._caches._default) {
        this._createCache(Defaults.cache);                      // Defaults to memory-based
    }

    this._ext = new Ext(['onPreStart']);

    Handler.register(this);
};


internals.Pack.prototype._createCache = function (options) {

    if (typeof options !== 'object') {
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

        client = new Catbox.Client(require(options.engine), settings);
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

    var self = this;

    // Add server

    var id = this._servers.length;
    this._byId[id] = server;
    this._servers.push(server);

    // Add to labels

    server.settings.labels.forEach(function (label) {

        self._byLabel[label] = self._byLabel[label] || [];
        self._byLabel[label].push(id);
    });

    // Subscribe to events

    this.events.addEmitter(server);

    return server;
};


internals.Pack.prototype.log = function (tags, data, timestamp, _server) {

    tags = (Array.isArray(tags) ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());

    var event = {
        server: (_server ? _server.info.uri : undefined),
        timestamp: now,
        tags: tags,
        data: data
    };

    var tagsMap = Hoek.mapToObject(event.tags);

    this.events.emit('log', event, tagsMap);

    if (_server) {
        _server.emit('log', event, tagsMap);
    }

    if (this._settings.debug &&
        this._settings.debug.request &&
        Hoek.intersect(tagsMap, this._settings.debug.request, true)) {

        console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Utils.stringify(data) : data)) : ''));
    }
};


internals.Pack.prototype.register = function (plugins /*, [options], callback */) {

    var self = this;

    plugins = [].concat(plugins);
    var options = (arguments.length === 3 ? arguments[1] : {});
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    /*
        var register = function (plugin, options, next) { next(); }
        register.attributes = {
            name: 'plugin',
            version: '1.1.1',
            pkg: require('../package.json')
        };

        plugin = {
            register: register,     // plugin: { register } when assigned a directly required module
            name: 'plugin',         // || register.attributes.name  || register.attributes.pkg.name
            version: '1.1.1',       // -optional- || register.attributes.version  || register.attributes.pkg.version
            options: {}             // -optional-
        };
    */

    var registrations = [];
    for (var i = 0, il = plugins.length; i < il; ++i) {
        var plugin = plugins[i];
        var hint = (plugins.length > 1 ? '(' + i + ')' : '');

        Hoek.assert(typeof plugin === 'object', 'Invalid plugin object', hint);
        Hoek.assert(!!plugin.register ^ !!plugin.plugin, 'One of plugin or register required but cannot include both', hint);
        Hoek.assert(typeof plugin.register === 'function' || (typeof plugin.plugin === 'object' && typeof plugin.plugin.register === 'function'), 'Plugin register must be a function or a required plugin module', hint);

        var register = plugin.register || plugin.plugin.register;
        var attributes = register.attributes || {};

        Hoek.assert(plugin.name || attributes, 'Incompatible plugin missing register function attributes', hint);
        Hoek.assert(plugin.name || attributes.name || (attributes.pkg && attributes.pkg.name), 'Missing plugin name', hint);

        var item = {
            register: register,
            name: plugin.name || attributes.name || attributes.pkg.name,
            version: plugin.version || attributes.version || (attributes.pkg && attributes.pkg.version) || '0.0.0',
            options: plugin.options
        };

        registrations.push(item);
    }

    var dependencies = {};
    Async.forEachSeries(registrations, function (item, next) {

        self._register(item, options, dependencies, next);
    },
    function (err) {

        if (err) {
            return callback(err);
        }

        Object.keys(dependencies).forEach(function (deps) {

            dependencies[deps].forEach(function (dep) {

                Hoek.assert(self._env[dep], 'Plugin', deps, 'missing dependencies:', dep);
            });
        });

        return callback();
    });
};


internals.Pack.prototype._register = function (plugin, registerOptions, dependencies, callback) {

    var self = this;

    Hoek.assert(!this._env[plugin.name], 'Plugin already registered:', plugin.name);
    Schema.assert('register', registerOptions);

    // Setup environment

    var env = {
        name: plugin.name,
        path: null,
        bind: null,
        route: {
            prefix: registerOptions.route && registerOptions.route.prefix,
            vhost: registerOptions.route && registerOptions.route.vhost
        }
    };

    this._env[plugin.name] = env;

    // Add plugin to servers lists

    this.list[plugin.name] = plugin;

    // Setup pack interface

    var step = function (labels, subset) {

        var selection = self._select(labels, subset);

        var methods = {
            length: selection.servers.length,
            servers: selection.servers,
            events: new Kilt(selection.servers),
            select: function (/* labels */) {

                var labels = Hoek.flatten(Array.prototype.slice.call(arguments));
                return step(labels, selection.index);
            },
            _expose: function (/* key, value */) {

                internals.expose(selection.servers, plugin, arguments);
            },
            route: function (options) {

                self._applySync(selection.servers, Server.prototype._route, [options, env]);
            },
            state: function () {

                self._applySync(selection.servers, Server.prototype.state, arguments);
            },
            auth: {
                scheme: function () {

                    self._applyChildSync(selection.servers, 'auth', 'scheme', arguments);
                },
                strategy: function () {

                    self._applyChildSync(selection.servers, 'auth', 'strategy', arguments);
                }
            },
            ext: function () {

                self._applySync(selection.servers, Server.prototype._ext, [arguments[0], arguments[1], arguments[2], env]);
            }
        };

        methods.expose = methods._expose;

        return methods;
    };

    // Setup root pack object

    var root = step(registerOptions.labels);

    root.hapi = require('../');
    root.version = root.hapi.version;
    root.app = self.app;
    root.plugins = self.plugins;
    root.methods = self._methods.methods;

    root.expose = function (/* key, value */) {

        root._expose.apply(null, arguments);
        internals.expose([self], plugin, arguments);
    };

    root.log = function (tags, data, timestamp) {

        self.log(tags, data, timestamp);
    };

    root.register = function (plugins /*, [options], callback */) {

        var options = (arguments.length === 3 ? arguments[1] : {});
        var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

        if (env.route.prefix ||
            env.route.vhost) {

            options = Hoek.clone(options);
            options.route = options.route || {};
            options.route.prefix = (env.route.prefix || '') + (options.route.prefix || '') || undefined;
            options.route.vhost = env.route.vhost || options.route.vhost;
        }

        internals.Pack.prototype.register.call(self, plugins, options, callback);
    };

    root.dependency = function (deps, after) {

        Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

        dependencies[plugin.name] = dependencies[plugin.name] || [];
        deps = [].concat(deps);
        deps.forEach(function (dep) {

            if (!self._env[dep]) {
                dependencies[plugin.name].push(dep);
            }
        });

        if (after) {
            self._ext.add('onPreStart', after, { after: deps }, env);
        }
    };

    root.after = function (method) {

        self._ext.add('onPreStart', method, {}, env);
    };

    root.bind = function (bind) {

        Hoek.assert(typeof bind === 'object', 'bind must be an object');
        env.bind = bind;
    };

    root.path = function (path) {

        Hoek.assert(path && typeof path === 'string', 'path must be a non-empty string');
        env.path = path;
    }

    root.views = function (options) {

        Hoek.assert(!env.views, 'Cannot set plugin views manager more than once');
        var override = (!options.basePath && env.path ? { basePath: env.path } : null);
        env.views = new Views.Manager(options, override);
    };

    root.method = function (/* name, method, options */) {

        var args = Array.prototype.slice.call(arguments);
        if (args.length === 2) {
            args.push(null);
        }
        args.push(env);

        return self._methods.add.apply(self._methods, args);
    };

    root.handler = function (/* name, method */) {

        var args = Array.prototype.slice.call(arguments);
        return self._handler.apply(self, args);
    };

    root.cache = function (options) {

        return self._provisionCache(options, 'plugin', plugin.name, options.segment);
    };

    env.root = root;

    // Register

    plugin.register.call(null, root, plugin.options || {}, callback);
};


internals.expose = function (dests, plugin, args) {

    var key = (args.length === 2 ? args[0] : null);
    var value = (args.length === 2 ? args[1] : args[0]);

    dests.forEach(function (dest) {

        dest.plugins[plugin.name] = dest.plugins[plugin.name] || {};
        if (key) {
            dest.plugins[plugin.name][key] = value;
        }
        else {
            Hoek.merge(dest.plugins[plugin.name], value);
        }
    });
};


internals.Pack.prototype._select = function (labels, subset) {

    var self = this;

    Hoek.assert(!labels || typeof labels === 'string' || Array.isArray(labels), 'Bad labels object type (undefined or array required)');
    labels = labels && [].concat(labels);

    var ids = [];
    if (labels) {
        labels.forEach(function (label) {

            ids = ids.concat(self._byLabel[label] || []);
        });

        ids = Hoek.unique(ids);
    }
    else {
        ids = Object.keys(this._byId);
    }

    var result = {
        servers: [],
        index: {}
    };

    ids.forEach(function (id) {

        if (subset &&
            !subset[id]) {

            return;
        }

        result.servers.push(self._byId[id]);
        result.index[id] = true;
    });

    return result;
};


internals.Pack.prototype.start = function (callback) {

    var self = this;

    this._invoke('onPreStart', function (err) {

        if (err) {
            if (callback) {
                callback(err);
            }

            return;
        }

        self._apply(self._servers, Server.prototype._start, null, function () {

            var caches = Object.keys(self._caches);
            Async.forEach(caches, function (cache, next) {

                self._caches[cache].client.start(next);
            }, function (err) {

                self.events.emit('start');

                if (callback) {
                    return callback(err);
                }
            });
        });
    });
};


internals.Pack.prototype.stop = function (options, callback) {

    var self = this;

    if (typeof options === 'function') {
        callback = arguments[0];
        options = {};
    }

    this._apply(this._servers, Server.prototype._stop, [options], function () {

        self.events.emit('stop');

        if (callback) {
            callback();
        }
    });
};


internals.Pack.prototype._apply = function (servers, func, args, callback) {

    Async.forEachSeries(servers, function (server, next) {

        func.apply(server, (args || []).concat([next]));
    },
    function (err) {

        return callback(err);
    });
};


internals.Pack.prototype._applySync = function (servers, func, args) {

    for (var i = 0, il = servers.length; i < il; ++i) {
        func.apply(servers[i], args);
    }
};


internals.Pack.prototype._applyChildSync = function (servers, child, func, args) {

    for (var i = 0, il = servers.length; i < il; ++i) {
        var obj = servers[i][child];
        obj[func].apply(obj, args);
    }
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

    var settings = (options.expiresIn || options.expiresAt ? { expiresIn: options.expiresIn, expiresAt: options.expiresAt, staleIn: options.staleIn, staleTimeout: options.staleTimeout } : {});
    var policy = new Catbox.Policy(settings, cache.client, segment);
    return policy;
};


internals.Pack.prototype._method = function () {

    return this._methods.add.apply(this._methods, arguments);
};


internals.Pack.prototype._handler = function (name, fn) {

    Hoek.assert(typeof name === 'string', 'Invalid handler name');
    Hoek.assert(!this._handlers[name], 'Handler name already exists:', name);
    Hoek.assert(typeof fn === 'function', 'Handler must be a function:', name);
    this._handlers[name] = fn;
};


internals.Pack.prototype._invoke = function (event, callback) {

    var self = this;

    var exts = this._ext._events[event];
    if (!exts) {
        return Hoek.nextTick(callback)();
    }

    Async.forEachSeries(exts.nodes, function (ext, next) {

        ext.func.call(null, ext.env.root, next);
    },
    function (err) {

        return callback(err);
    });
};


/*
var config = {
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
        }
    }
};
*/

internals.Pack.compose = function (manifest /*, [options], callback */) {

    var options = arguments.length === 2 ? {} : arguments[1];
    var callback = arguments.length === 2 ? arguments[1] : arguments[2];

    // Create pack

    Hoek.assert(manifest.servers && manifest.servers.length, 'Manifest missing servers definition');
    Hoek.assert(manifest.plugins, 'Manifest missing plugins definition');
    Hoek.assert(options, 'Invalid options');
    Hoek.assert(typeof callback === 'function', 'Invalid callback');

    var pack = new internals.Pack(manifest.pack);

    // Load servers

    manifest.servers.forEach(function (server) {

        if (server.host &&
            server.host.indexOf('$env.') === 0) {

            server.host = process.env[server.host.slice(5)];
        }

        if (server.port &&
            typeof server.port === 'string' &&
            server.port.indexOf('$env.') === 0) {

            server.port = parseInt(process.env[server.port.slice(5)], 10);
        }

        pack.server(server.host, server.port, server.options);
    });

    // Load plugin

    var plugins = [];
    var names = Object.keys(manifest.plugins);
    names.forEach(function (name) {

        var path = name;
        if (options.relativeTo &&
            path[0] === '.') {

            path = Path.join(options.relativeTo, path);
        }

        plugins.push({ plugin: require(path), options: manifest.plugins[name] });
    });

    pack.register(plugins, function (err) {

        return callback(err, pack);
    });
};
