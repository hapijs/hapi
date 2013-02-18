// Load modules

var Fs = require('fs');
var Path = require('path');
var Events = require('events');
var Async = require('async');
var Server = require('./server');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Pack = function (config) {

    this.config = Utils.clone(config || {});            // Plugin shared configuration
    this.servers = [];                                  // List of all pack server members
    this.labels = {};                                   // Server [names] organized by labels
    this.names = {};                                    // Servers indexed by name
    this.events = new Events.EventEmitter();            // Consolidated subscription to all servers' events

    return this;
};


/*
    var options = {
        autoLabel: true,                                    // Automatically add default labales (secure, cached)
        labels: ['web']                                     // Server labels used for selection
    };
*/

internals.Pack.prototype.server = function (name, server, options) {

    var self = this;

    options = options || {};

    Utils.assert(!this.names[name], 'Server name already in pack');
    Utils.assert(server && server instanceof Server, 'Invalid server');
    Utils.assert(!options.labels || typeof options.labels === 'string' || options.labels instanceof Array, 'Bad options.labels');

    var serverLabels = Utils.clone(options.labels);
    serverLabels = serverLabels ? (serverLabels instanceof Array ? serverLabels : [serverLabels]) : [];

    // Add standard labels

    if (options.autoLabel !== false) {            // Defaults to true
        if (server.settings.tls) {
            serverLabels.push('secure');
        }

        if (server.cache) {
            serverLabels.push('cached');
        }
    }

    serverLabels = Utils.unique(serverLabels);

    // Add server

    this.names[name] = server;
    this.servers.push(server);

    // Add to labels

    serverLabels.forEach(function (label) {

        self.labels[label] = self.labels[label] || [];
        self.labels[label].push(name);
    });

    // Subscribe to events

    ['log', 'response', 'tail'].forEach(function (event) {

        server.on(event, function (request, data) {

            self.events.emit(event, request, data);
        });
    });
};


internals.Pack.prototype.validate = function (plugin) {

    Utils.assert(plugin, 'Missing plugin');

    if (!plugin.name) {
        return new Error('Plugin missing name');
    }

    if (!plugin.version) {
        return new Error('Plugin missing version');
    }

    if (!plugin.register ||
        typeof plugin.register !== 'function') {

        return new Error('Plugin missing register() method');
    }

    // Valid
    return null;
};


/*
    var options = {
        name: 'steve',              // Overrides the module name when registering with server.plugin.list and server.plugins
        plugin: {},                 // Plugin-specific options
        permissions: {              // Overrides the default permissions granted to the plugin (defaults listed)
            route: true,
            helper: true,
            state: true,
            ext: false
        }
    };
*/

internals.Pack.prototype.register = function (plugin/*, [options], callback */) {

    var self = this;

    // Validate arguments

    var options = (arguments.length === 3 ? arguments[1] : {});
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    Utils.assert(plugin, 'Missing plugin');
    Utils.assert(callback, 'Missing callback');

    var invalid = this.validate(plugin);
    if (invalid) {
        return callback(invalid);
    }

    // Add plugin to servers lists

    var pluginName = options.name || plugin.name;
    this.servers.forEach(function (server) {

        server.plugin.list[pluginName] = plugin;
    });

    // Permissions

    var permissions = {
        route: true,
        helper: true,
        state: true,
        events: true,
        ext: false
    };

    Utils.merge(permissions, options.permissions);

    // Setup pack interface

    var step = function (criteria, subset) {

        var selection = self.select(criteria, subset);

        var methods = {
            version: Utils.version,
            config: self.config,
            length: selection.servers.length,
            options: options.plugin || {},
            next: callback,

            api: function (set) {

                selection.servers.forEach(function (server) {

                    server.plugins[pluginName] = server.plugins[pluginName] || {};
                    Utils.merge(server.plugins[pluginName], set);
                });
            },
            select: function (criteria) {

                return step(criteria, selection.index);
            }
        };

        if (permissions.route) {
            methods.route = function (options) {

                self._applySync(selection.servers, Server.prototype.route, [options]);
            };
        }

        if (permissions.state) {
            methods.state = function (name, options) {

                self._applySync(selection.servers, Server.prototype.state, [name, options]);
            };
        }

        if (permissions.helper) {
            methods.helper = function (name, method, options) {

                self._applySync(selection.servers, Server.prototype.helper, [name, method, options]);
            };
        }

        if (permissions.events) {
            methods.events = self.events;
        }

        if (permissions.ext) {
            methods.ext = function (event, func) {

                self._applySync(selection.servers, Server.prototype.ext, [event, func]);
            };
        }

        return methods;
    };

    // Register

    plugin.register.call(null, step(), options.plugin || {}, callback);
};


internals.Pack.prototype.select = function (criteria, subset) {

    var self = this;

    Utils.assert(!criteria || typeof criteria === 'object', 'Bad criteria object type');

    var names = [];

    if (criteria) {
        if (criteria.names ||
            criteria.name) {

            ['names', 'name'].forEach(function (item) { names = names.concat(criteria[item] || []); });
        }

        if (criteria.labels ||
            criteria.label) {

            var labels = [];
            ['labels', 'label'].forEach(function (item) { labels = labels.concat(criteria[item] || []); });

            labels.forEach(function (label) {

                names = names.concat(self.labels[label]);
            });
        }

        Utils.unique(names);
    }
    else {
        names = names.concat(Object.keys(subset || this.names));
    }

    var servers = [];
    var index = {};
    names.forEach(function (name) {

        if (subset &&
            !subset[name]) {

            return;
        }

        var server = self.names[name];
        if (server) {
            servers.push(server);
            index[name] = true;
        }
    });

    return { servers: servers, index: index };
};


internals.Pack.prototype.require = function (name/*, [options], callback*/) {

    var options = (arguments.length === 3 ? arguments[1] : {});
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    if (name[0] === '.') {
        name = internals.getSourceFilePath() + '/' + name;
    }
    else if (name[0] !== '/') {
        name = require.main.paths[0] + '/' + name;
    }

    var plugin = null;

    try {
        var mod = require(name);
        var pkg = require(name + '/package.json');

        plugin = {
            name: pkg.name,
            version: pkg.version,
            register: mod.register
        };
    }
    catch (err) {
        return callback(err);
    }

    this.register(plugin, options, callback);
};


internals.Pack.prototype.requireDirectory = function (path /*, options, callback */) {

    if (path[0] === '.') {
        path = internals.getSourceFilePath() + '/' + path;
    }

    path = Path.resolve(path);
    var options = (arguments.length === 3 ? arguments[1] : {});
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    var exclude = options.exclude || [];
    exclude = Utils.mapToObject(exclude instanceof Array ? exclude : [exclude]);

    var names = [];
    Fs.readdirSync(path).forEach(function (filename) {

        if (filename.indexOf('.') !== -1 ||
            exclude[filename]) {

            return;
        }

        names.push(path + '/' + filename);
    });

    this.requireList(names, options, callback);
};


internals.Pack.prototype.requireList = function (names/*, [options], callback*/) {

    var self = this;

    var options = (arguments.length === 3 ? arguments[1] : {});
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    Async.forEachSeries(names, function (name, next) {

        self.require(name, options, next);
    },
    function (err) {

        return callback(err);
    });
};


internals.Pack.prototype.start = function (callback) {

    this._apply(this.servers, Server.prototype.start, null, callback || function () { });
};


internals.Pack.prototype.stop = function () {

    this._applySync(this.servers, Server.prototype.stop);
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


internals.getSourceFilePath = function () {

    // 0 - internals.getSourceFilePath
    // 1 - internals.Pack.require / internals.Pack.requireDirectory
    // 2 - **Caller

    var stack = Utils.callStack();
    return stack[2][0].substring(0, stack[2][0].lastIndexOf('/'));
};


