// Load modules

var Fs = require('fs');
var Path = require('path');
var Async = require('async');
var Semver = require('semver');
var Server = require('./server');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Pack = function (config, options) {

    this.settings = Utils.clone(options || {});         // Pack creation options

    this.version = Utils.version();                     // hapi version
    this.config = Utils.clone(config || {});            // Plugin shared configuration
    this.servers = [];                                  // List of all pack server members
    this.labels = {};                                   // Server [names] organized by labels
    this.names = {};                                    // Servers indexed by name

    this.plugins = {};                                  // Raw plugins objects

    return this;
};


internals.Pack.prototype.addServer = function (name, server, labels) {

    var self = this;

    Utils.assert(!this.names[name], 'Server name already in pack');
    Utils.assert(server && server instanceof Server, 'Invalid server');
    Utils.assert(!labels || typeof labels === 'string' || labels instanceof Array, 'Bad labels argument');

    var serverLabels = Utils.clone(labels);
    serverLabels = serverLabels ? (serverLabels instanceof Array ? serverLabels : [serverLabels]) : [];

    // Add standard labels

    if (this.settings.autoLabel !== false) {            // Defaults to true
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
};


internals.Pack.prototype.select = function (criteria) {

    if (!criteria) {
        return this;
    }

    // Create a selection...
};


internals.Pack.prototype.validate = function (plugin) {

    Utils.assert(plugin, 'Missing plugin');

    if (!plugin.hapi ||
        !plugin.hapi.plugin) {

        return new Error('Not a hapi plugin');
    }

    if (plugin.hapi.version &&
        !Semver.satisfies(this.version, plugin.hapi.version)) {

        return new Error('Incompatible hapi plugin version');
    }

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


internals.Pack.prototype.register = function (plugin, callback) {

    var self = this;

    Utils.assert(plugin, 'Missing plugin');
    Utils.assert(callback, 'Missing callback');

    var invalid = this.validate(plugin);
    if (invalid) {
        return callback(invalid);
    }

    var step = function (criteria, subset) {

        var selection = self.find(criteria, subset);

        var methods = {
            version: self.version,
            config: self.config,
            length: selection.servers.length,

            addRoute: function (options) {

                self._applySync(selection.servers, Server.prototype.addRoute, [options]);
            },
            addRoutes: function (routes) {

                self._applySync(selection.servers, Server.prototype.addRoutes, [routes]);
            },
            addState: function (name, options) {

                self._applySync(selection.servers, Server.prototype.addState, [name, options]);
            },
            addHelper: function (name, method, options) {

                self._applySync(selection.servers, Server.prototype.addHelper, [name, method, options]);
            },
            select: function (criteria) {

                return step(criteria, selection.index);
            }
        };

        return methods;
    };

    var packApi = step();
    plugin.register.call(packApi, packApi, callback);
};


internals.Pack.prototype.find = function (criteria, subset) {

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


internals.Pack.prototype.require = function (name, callback) {

    var plugin = null;

    if (name[0] === '.') {
        name = internals.getSourceFilePath() + '/' + name;
    }

    try {
        var pkg = require(name + '/package.json');
        var mod = require(name);

        plugin = {
            name: pkg.name,
            version: pkg.version,
            hapi: pkg.hapi,
            register: mod.register
        }
    }
    catch (err) {
        return callback(err);
    }

    this.register(plugin, callback);
};


internals.Pack.prototype.requireDirectory = function (path /*, exclude, callback */) {

    if (path[0] === '.') {
        path = internals.getSourceFilePath() + '/' + path;
    }

    path = Path.resolve(path);
    var exclude = (arguments.length === 3 ? arguments[1] : []);
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    exclude = Utils.mapToObject(exclude instanceof Array ? exclude : [exclude]);

    var names = [];
    Fs.readdirSync(path).forEach(function (filename) {

        if (filename.indexOf('.') !== -1 ||
            exclude[filename]) {

            return;
        }

        names.push(path + '/' + filename);
    });

    this.requireList(names, callback);
};


internals.Pack.prototype.requireList = function (names, callback) {

    var self = this;

    Async.forEachSeries(names, function (name, next) {

        self.require(name, next);
    },
    function (err) {

        return callback(err);
    });
};


internals.Pack.prototype.start = function (callback) {

    this._apply(this.servers, Server.prototype.start, null, callback);
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


