// Load modules

var Path = require('path');
var Events = require('events');
var Async = require('async');
var Catbox = require('catbox');
var Server = require('./server');
var Views = require('./views');
var Utils = require('./utils');
var Defaults = require('./defaults');
var Ext = require('./ext');
var Methods = require('./methods');
var Handler = require('./handler');
var Hapi = require('./index');


// Declare internals

var internals = {};


exports = module.exports = internals.Pack = function (options) {

    options = options || {};

    this._settings = {};

    if (options.requirePath) {
        this._settings.requirePath = Path.resolve(options.requirePath);
    }

    this._settings.debug = Utils.applyToDefaults(Defaults.server.debug, options.debug);

    this._servers = [];                                                 // List of all pack server members
    this._byLabel = {};                                                 // Server [ids] organized by labels
    this._byId = {};                                                    // Servers indexed by id
    this._env = {};                                                     // Plugin-specific environment (e.g. views manager)
    this._caches = {};                                                  // Cache clients
    this._methods = new Methods(this);                                  // Server methods
    this._handlers = {};                                                // Registered handlers

    this.list = {};                                                     // Loaded plugins by name
    this.plugins = {};                                                  // Exposed plugin properties by name
    this.events = new Events.EventEmitter();                            // Consolidated subscription to all servers' events
    this.app = options.app || {};

    this.hapi = require('./');

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
    Utils.assert(!this._caches[name], 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

    var client = null;
    if (typeof options.engine === 'object') {
        client = new Catbox.Client(options.engine);
    }
    else {
        var settings = Utils.clone(options);
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
            Utils.assert(!arg.cache, 'Cannot configure server cache in a pack member');
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

    ['request', 'response', 'tail', 'internalError'].forEach(function (event) {

        server.on(event, function (request, data, tags) {

            self.events.emit(event, request, data, tags);
        });
    });

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

    var tagsMap = Utils.mapToObject(event.tags);

    this.events.emit('log', event, tagsMap);

    if (_server) {
        _server.emit('log', event, tagsMap);
    }

    if (this._settings.debug &&
        this._settings.debug.request &&
        Utils.intersect(tagsMap, this._settings.debug.request, true)) {

        console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Utils.stringify(data) : data)) : ''));
    }
};


internals.Pack.prototype.register = function (plugin/*, [options], callback */) {

    // Validate arguments

    var options = (arguments.length === 3 ? arguments[1] : null);
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    this._register(plugin, options, callback, null);
};


internals.Pack.prototype._register = function (plugin, options, callback, _dependencies) {

    var self = this;

    // Validate arguments

    Utils.assert(plugin, 'Missing plugin');
    Utils.assert(callback, 'Missing callback');
    Utils.assert(!this._env[plugin.name], 'Plugin already registered:', plugin.name);
    Utils.assert(plugin.name, 'Plugin missing name');
    Utils.assert(plugin.name !== '?', 'Plugin name cannot be \'?\'');
    Utils.assert(plugin.version, 'Plugin missing version');
    Utils.assert(plugin.register && typeof plugin.register === 'function', 'Plugin missing register() method');

    var dependencies = _dependencies || {};

    // Setup environment

    var env = {
        name: plugin.name,
        path: plugin.path,
        bind: null
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
            select: function (/* labels */) {

                var labels = Utils.flatten(Array.prototype.slice.call(arguments));
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

    var root = step();

    root.version = Hapi.version;
    root.hapi = self.hapi;
    root.app = self.app;
    root.path = plugin.path;
    root.plugins = self.plugins;
    root.events = self.events;
    root.methods = self._methods.methods;
    root.handlers = self._handlers;

    root.expose = function (/* key, value */) {

        root._expose.apply(null, arguments);
        internals.expose([self], plugin, arguments);
    };

    root.log = function (tags, data, timestamp) {

        self.log(tags, data, timestamp);
    };

    root.dependency = function (deps, after) {

        Utils.assert(!after || typeof after === 'function', 'Invalid after method');

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

    root.loader = function (requireFunc) {

        Utils.assert(!requireFunc || typeof requireFunc === 'function', 'Argument must be null or valid function');
        root._requireFunc = requireFunc;
    };

    root.bind = function (bind) {

        Utils.assert(typeof bind === 'object', 'bind must be an object');
        env.bind = bind;
    };

    root.views = function (options) {

        Utils.assert(!env.views, 'Cannot set plugin views manager more than once');
        options.basePath = options.basePath || plugin.path;
        env.views = new Views.Manager(options, root._requireFunc);
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

    root.require = function (name/*, [options], requireCallback*/) {

        var options = (arguments.length === 3 ? arguments[1] : null);
        var requireCallback = (arguments.length === 3 ? arguments[2] : arguments[1]);

        self._require(name, options, requireCallback, root._requireFunc);
    };

    env.root = root;

    // Register

    plugin.register.call(null, root, options || {}, function (err) {

        if (!_dependencies &&
            dependencies[plugin.name]) {

            Utils.assert(!dependencies[plugin.name].length, 'Plugin', plugin.name, 'missing dependencies:', dependencies[plugin.name].join(', '));
        }

        callback(err);
    });
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
            Utils.merge(dest.plugins[plugin.name], value);
        }
    });
};


internals.Pack.prototype._select = function (labels, subset) {

    var self = this;

    Utils.assert(!labels || Array.isArray(labels), 'Bad labels object type (undefined or array required)');

    var ids = [];
    if (labels) {
        labels.forEach(function (label) {

            ids = ids.concat(self._byLabel[label] || []);
        });

        ids = Utils.unique(ids);
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


/*
    name:
        'plugin' - module in main process node_module directory
        './plugin' - relative path to file where require is called
        '/plugin' - absolute path
        { 'plugin': { plugin-options } } - object where keys are loaded as module names (above) and values are plugin options
        [ 'plugin' ] - array of plugin names, without plugin options
*/

internals.Pack.prototype.require = function (name/*, [options], callback*/) {

    var options = (arguments.length === 3 ? arguments[1] : null);
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    this._require(name, options, callback);
};


internals.Pack.prototype._require = function (name, options, callback, requireFunc) {

    var self = this;

    Utils.assert(name && (typeof name === 'string' || typeof name === 'object'), 'Invalid plugin name(s) object: must be string, object, or array');
    Utils.assert(!options || typeof name === 'string', 'Cannot provide options in a multi-plugin operation');

    requireFunc = requireFunc || require;

    var callerPath = internals.getSourceFilePath();         // Must be called outside any other function to keep call stack size identical

    var parse = function () {

        var registrations = [];

        if (typeof name === 'string') {
            registrations.push({ name: name, options: options });
        }
        else if (Array.isArray(name)) {
            name.forEach(function (item) {

                registrations.push({ name: item, options: null });
            });
        }
        else {
            Object.keys(name).forEach(function (item) {

                registrations.push({ name: item, options: name[item] });
            });
        }

        var dependencies = {};
        Async.forEachSeries(registrations, function (item, next) {

            load(item, dependencies, next);
        },
        function (err) {

            Object.keys(dependencies).forEach(function (deps) {

                dependencies[deps].forEach(function (dep) {

                    Utils.assert(self._env[dep], 'Plugin', deps, 'missing dependencies:', dep);
                });
            });

            return callback(err);
        });
    };

    var load = function (item, dependencies, next) {

        var itemName = item.name;
        if (itemName[0] === '.') {
            itemName = Path.join(callerPath, itemName);
        }
        else if (itemName[0] !== '/' &&
                 self._settings.requirePath) {

            itemName = Path.join(self._settings.requirePath, itemName);
        }

        var packageFile = Path.join(itemName, 'package.json');

        var mod = requireFunc(itemName);                                                        // Will throw if require fails
        var pkg = requireFunc(packageFile);

        var plugin = {
            name: pkg.name,
            version: pkg.version,
            register: mod.register,
            path: internals.packagePath(pkg.name, packageFile)
        };

        self._register(plugin, item.options, next, dependencies);
    };

    parse();
};


internals.getSourceFilePath = function () {

    var stack = Utils.callStack();
    var callerFile = '';
    var i = 0;
    var il = stack.length;

    while (callerFile === '' && i < il) {
        var stackLine = stack[i];
        if (stackLine[3].lastIndexOf('.require') === stackLine[3].length - 8) {             // The file that calls require is next
            callerFile = stack[i + 1][0];
        }
        ++i;
    }

    return Path.dirname(callerFile);
};


internals.packagePath = function (name, packageFile) {

    var path = null;

    var keys = Object.keys(require.cache);
    var i = 0;
    var il = keys.length;

    while (path === null && i < il) {
        var key = keys[i];
        if (key.indexOf(packageFile) === key.length - packageFile.length) {
            var record = require.cache[key];
            if (record.exports.name === name) {
                path = Path.dirname(key);
            }
        }
        ++i;
    }

    return path;
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

    Utils.assert(options && typeof options === 'object', 'Invalid cache policy options');
    Utils.assert(name, 'Invalid cache policy name');
    Utils.assert(['method', 'plugin', 'server'].indexOf(type) !== -1, 'Unknown cache policy type:', type);

    var cacheName = options.cache || '_default';
    var cache = this._caches[cacheName];
    Utils.assert(cache, 'Unknown cache', cacheName);

    if (type === 'method') {
        Utils.assert(!segment || segment.indexOf('##') === 0, 'Server method cache segment must start with \'##\'');
        segment = segment || '#' + name;
    }
    else if (type === 'plugin') {
        Utils.assert(!segment || segment.indexOf('!!') === 0, 'Plugin cache segment must start with \'!!\'');
        segment = segment || '!' + name;
    }
    else {      // server
        segment = '|' + name;
    }

    Utils.assert(cache.shared || options.shared || !cache.segments[segment], 'Cannot provision the same cache segment more than once');
    cache.segments[segment] = true;

    var settings = (options.expiresIn || options.expiresAt ? { expiresIn: options.expiresIn, expiresAt: options.expiresAt, staleIn: options.staleIn, staleTimeout: options.staleTimeout } : {});
    var policy = new Catbox.Policy(settings, cache.client, segment);
    return policy;
};


internals.Pack.prototype._method = function () {

    return this._methods.add.apply(this._methods, arguments);
};


internals.Pack.prototype._handler = function (name, fn) {

    Utils.assert(typeof name === 'string', 'Invalid handler name');
    Utils.assert(!this._handlers[name], 'Handler name already exists:', name);
    Utils.assert(typeof fn === 'function', 'Handler must be a function:', name);
    this._handlers[name] = fn;
};


internals.Pack.prototype._invoke = function (event, callback) {

    var self = this;

    var exts = this._ext._events[event];
    if (!exts) {
        return Utils.nextTick(callback)();
    }

    Async.forEachSeries(exts.nodes, function (ext, next) {

        ext.func.call(null, ext.env.root, next);
    },
    function (err) {

        return callback(err);
    });
};
