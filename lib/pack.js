// Load modules

var Path = require('path');
var Events = require('events');
var Async = require('async');
var Catbox = require('catbox');
var Server = require('./server');
var Views = require('./views');
var Utils = require('./utils');
var Defaults = require('./defaults');


// Declare internals

var internals = {};

internals.defaultPermissions = {
    route: true,
    helper: true,
    state: true,
    events: true,
    views: true,
    cache: true,
    auth: true,
    ext: false
};


exports = module.exports = internals.Pack = function (options) {

    options = options || {};

    this._settings = {};

    if (options.requirePath) {
        this._settings.requirePath = Path.resolve(options.requirePath);
    }

    this._servers = [];                                                 // List of all pack server members
    this._byLabel = {};                                                 // Server [ids] organized by labels
    this._byId = {};                                                    // Servers indexed by id
    this._env = {};                                                     // Plugin-specific environment (e.g. views manager)

    this.list = {};                                                     // Loaded plugins by name
    this.events = new Events.EventEmitter();                            // Consolidated subscription to all servers' events
    this.app = options.app || {};

    this.hapi = require('./');

    var cacheOptions = Catbox.defaults.apply(options.cache || Defaults.cache);
    if (!options.cache ||
        !options.cache.partition) {

        cacheOptions.partition = 'hapi-cache';
    }

    this._cache = new Catbox.Client(cacheOptions);   // Common cache (defaults to memory-based)
};


internals.Pack.prototype.server = function (arg1, arg2, arg3) {

    [arg1, arg2, arg3].forEach(function (arg) {    // Server arguments can appear in any order

        if (typeof arg === 'object') {
            Utils.assert(!arg.cache, 'Cannot configure server cache in a pack member');
        }
    });

    this._server(new Server(arg1, arg2, arg3, this));
};


internals.Pack.prototype._server = function (server) {

    var self = this;

    var serverLabels = [].concat(server.settings.labels || []);
    serverLabels = Utils.unique(serverLabels);

    // Add server

    var id = this._servers.length;
    this._byId[id] = server;
    this._servers.push(server);

    // Add to labels

    serverLabels.forEach(function (label) {

        self._byLabel[label] = self._byLabel[label] || [];
        self._byLabel[label].push(id);
    });

    // Subscribe to events

    ['log', 'request', 'response', 'tail', 'internalError'].forEach(function (event) {

        server.on(event, function (request, data) {

            self.events.emit(event, request, data);
        });
    });
};


internals.Pack.prototype.register = function (plugin/*, [options], callback */) {

    // Validate arguments

    var options = (arguments.length === 3 ? arguments[1] : null);
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);
    var permissions = internals.defaultPermissions;

    if (options instanceof Array) {
        permissions = Utils.applyToDefaults(permissions, options[0] || {});
        options = options[1] || null;
    }

    this._register(plugin, permissions, options, callback);
};


internals.Pack.prototype._register = function (plugin, permissions, options, callback, _dependencies) {

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

    this._env[plugin.name] = {
        name: plugin.name,
        path: plugin.path
    };

    // Add plugin to servers lists

    this.list[plugin.name] = plugin;

    // Setup pack interface

    var step = function (labels, subset) {

        var selection = self._select(labels, subset);

        var methods = {
            length: selection.servers.length,
            select: function (/* labels */) {

                var labels = Utils.flatten(Array.prototype.slice.call(arguments));
                return step(labels, selection.index);
            },

            api: function (/* key, value */) {

                var key = (arguments.length === 2 ? arguments[0] : null);
                var value = (arguments.length === 2 ? arguments[1] : arguments[0]);

                selection.servers.forEach(function (server) {

                    server.plugins[plugin.name] = server.plugins[plugin.name] || {};
                    if (key) {
                        server.plugins[plugin.name][key] = value;
                    }
                    else {
                        Utils.merge(server.plugins[plugin.name], value);
                    }
                });
            }
        };

        if (permissions.route) {
            methods.route = function (options) {

                self._applySync(selection.servers, Server.prototype._route, [options, self._env[plugin.name]]);
            };
        }

        if (permissions.state) {
            methods.state = function () {

                self._applySync(selection.servers, Server.prototype.state, arguments);
            };
        }

        if (permissions.auth) {
            methods.auth = function () {

                self._applySync(selection.servers, Server.prototype.auth, arguments);
            };
        }

        if (permissions.ext) {
            methods.ext = function () {

                self._applySync(selection.servers, Server.prototype._ext, [arguments[0], arguments[1], arguments[2], plugin.name]);
            };
        }

        return methods;
    };

    // Setup root pack object

    var root = step();

    root.version = Utils.version();
    root.hapi = self.hapi;
    root.app = self.app;
    root.path = plugin.path;

    root.log = function (tags, data, timestamp) {

        tags = (tags instanceof Array ? tags : [tags]);
        var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());

        var event = {
            timestamp: now,
            tags: tags,
            data: data
        };

        self.events.emit('log', event, Utils.mapToObject(event.tags));
    };

    root.dependency = function (deps) {

        dependencies[plugin.name] = dependencies[plugin.name] || [];
        deps = [].concat(deps);
        deps.forEach(function (dep) {

            if (!self._env[dep]) {
                dependencies[plugin.name].push(dep);
            }
        });
    };

    if (permissions.events) {
        root.events = self.events;
    }

    if (permissions.views) {
        root.views = function (options) {

            Utils.assert(!self._env[plugin.name].views, 'Cannot set plugin views manager more than once');
            options.basePath = options.basePath || plugin.path;
            self._env[plugin.name].views = new Views(options);
        };
    }

    if (permissions.helper) {
        root.helper = function () {

            self._applySync(self._servers, Server.prototype.helper, arguments);
        };
    }

    if (permissions.cache) {
        root.cache = function (options) {

            return self._provisionCache(options, 'plugin', plugin.name, options.segment);
        };
    }

    // Register

    plugin.register.call(null, root, options || {}, function (err) {

        if (!_dependencies &&
            dependencies[plugin.name]) {

            Utils.assert(!dependencies[plugin.name].length, 'Plugin', plugin.name, 'missing dependencies:', dependencies[plugin.name].join(', '));
        }

        callback(err);
    });
};


internals.Pack.prototype._select = function (labels, subset) {

    var self = this;

    Utils.assert(!labels || typeof labels === 'string' || labels instanceof Array, 'Bad labels object type (string or array required)');

    var ids = [];
    if (labels) {
        [].concat(labels).forEach(function (label) {

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

        var server = self._byId[id];
        if (server) {
            result.servers.push(server);
            result.index[id] = true;
        }
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
    var permissions = internals.defaultPermissions;

    if (options instanceof Array) {
        permissions = Utils.applyToDefaults(permissions, options[0] || {});
        options = options[1] || null;
    }

    this._require(name, permissions, options, callback);
};


internals.Pack.prototype._require = function (name, permissions, options, callback) {

    var self = this;

    Utils.assert(name && (typeof name === 'string' || typeof name === 'object'), 'Invalid plugin name(s) object: must be string, object, or array');
    Utils.assert(!options || typeof name === 'string', 'Cannot provide options in a multi-plugin operation');

    var callerPath = internals.getSourceFilePath();         // Must be called outside any other function to keep call stack size identical

    var parse = function () {

        var registrations = [];

        if (typeof name === 'string') {
            registrations.push({ name: name, options: options, permissions: permissions });
        }
        else if (name instanceof Array) {
            name.forEach(function (item) {

                registrations.push({ name: item, options: null, permissions: permissions });
            });
        }
        else {
            Object.keys(name).forEach(function (item) {

                var reg = {
                    name: item,
                    options: name[item],
                    permissions: permissions
                };

                if (reg.options instanceof Array) {
                    reg.permissions = Utils.applyToDefaults(reg.permissions, reg.options[0] || {});
                    reg.options = reg.options[1] || null;
                }

                registrations.push(reg);
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

        var mod = require(itemName);                                                        // Will throw if require fails
        var pkg = require(packageFile);

        var plugin = {
            name: pkg.name,
            version: pkg.version,
            register: mod.register,
            path: internals.packagePath(pkg.name, packageFile)
        };

        self._register(plugin, item.permissions, item.options, next, dependencies);
    };

    parse();
};


internals.getSourceFilePath = function () {

    var stack = Utils.callStack();
    var callerFile = '';

    for (var i = 0, il = stack.length; i < il; ++i) {
        var stackLine = stack[i];
        if (stackLine[3].lastIndexOf('.require') === stackLine[3].length - 8) {             // The file that calls require is next
            callerFile = stack[i + 1][0];
            break;
        }
    }

    return Path.dirname(callerFile);
};


internals.packagePath = function (name, packageFile) {

    var path = null;

    var keys = Object.keys(require.cache);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var key = keys[i];
        if (key.indexOf(packageFile) === key.length - packageFile.length) {
            var record = require.cache[key];
            if (record.exports &&
                record.exports.name === name) {

                path = Path.dirname(key);
                break;
            }
        }
    }

    return path;
};


internals.Pack.prototype.allow = function (permissions) {

    var self = this;

    Utils.assert(permissions && typeof permissions === 'object', 'Invalid permission object');

    var rights = Utils.applyToDefaults(internals.defaultPermissions, permissions);

    var scoped = {
        register: function (name, options, callback) {

            var pluginPermissions = rights;
            if (options instanceof Array) {
                pluginPermissions = Utils.applyToDefaults(pluginPermissions, options[0] || {});
                options = options[1] || null;
            }

            self._register(name, pluginPermissions, callback ? options : null, callback || options);
        },
        require: function (name, options, callback) {

            var pluginPermissions = rights;
            if (options instanceof Array) {
                pluginPermissions = Utils.applyToDefaults(pluginPermissions, options[0] || {});
                options = options[1] || null;
            }

            self._require(name, pluginPermissions, callback ? options : null, callback || options);
        }
    };

    return scoped;
};


internals.Pack.prototype.start = function (callback) {

    var self = this;

    this._apply(this._servers, Server.prototype._start, null, function () {

        self._cache.start(callback || Utils.ignore);
    });
};


internals.Pack.prototype.stop = function (options, callback) {

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    this._apply(this._servers, Server.prototype._stop, [options], callback || Utils.ignore);
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


internals.Pack.prototype._provisionCache = function (options, type, name, segment) {

    Utils.assert(options, 'Invalid cache policy options');
    Utils.assert(name, 'Invalid cache policy name');
    Utils.assert(['helper', 'route', 'plugin'].indexOf(type) !== -1, 'Unknown cache policy type:', type);

    if (type === 'helper') {
        Utils.assert(!segment || segment.indexOf('##') === 0, 'Helper cache segment must start with \'##\'');
        segment = segment || '#' + name;
    }
    else if (type === 'route') {
        Utils.assert(!segment || segment.indexOf('//') === 0, 'Route cache segment must start with \'//\'');
        segment = segment || name;      // name (path) already includes '/'
    }
    else if (type === 'plugin') {
        Utils.assert(!segment || segment.indexOf('!!') === 0, 'Plugin cache segment must start with \'!!\'');
        segment = segment || '!' + name;
    }

    var policy = new Catbox.Policy(options, this._cache, segment);
    return policy;
};

