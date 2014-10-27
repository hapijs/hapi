// Load modules

var Hoek = require('hoek');
var Kilt = require('kilt');
var Topo = require('topo');
var Vision = require('vision');
var Schema = require('./schema');
var Server = require('./server');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Plugin = function (pack, servers, labels, plugin, env, options) {

    var self = this;

    options = options || {};

    // Validate options

    Schema.assert('register', options);

    // Setup environment

    this._env = env || {
        name: plugin.name,
        path: null,
        bind: null,
        views: null,
        route: {
            prefix: options.route && options.route.prefix,
            vhost: options.route && options.route.vhost
        }
    };

    this._pack = pack;
    this._selection = this._select(labels, servers);
    this.length = this._selection.servers.length;
    this.servers = this._selection.servers;
    this.events = new Kilt(this._selection.servers, this._pack._events);

    this.hapi = require('../');
    this.version = this.hapi.version;
    this.config = { route: this._env.route };
    this.app = this._pack.app;
    this.plugins = this._pack.plugins;
    this.methods = this._pack._methods.methods;

    this.auth = {
        scheme: function () {

            internals.applyChildSync(self._selection.servers, 'auth', 'scheme', arguments);
        },
        strategy: function () {

            internals.applyChildSync(self._selection.servers, 'auth', 'strategy', arguments);
        }
    };
};


// labels -> options.select

internals.Plugin.prototype.select = function (/* labels */) {

    var labels = Hoek.flatten(Array.prototype.slice.call(arguments));
    return new internals.Plugin(this._pack, this._selection.servers, labels, null, this._env);
};


internals.Plugin.prototype.expose = function (/* key, value */) {

    internals.expose(this._selection.servers, this._env.name, arguments);     // server.plugins

    if (this._selection.servers.length === this._pack._servers.length) {
        internals.expose([this._pack], this._env.name, arguments);            // pack.plugins
    }
};


internals.expose = function (dests, name, args) {

    var key = (args.length === 2 ? args[0] : null);
    var value = (args.length === 2 ? args[1] : args[0]);

    dests.forEach(function (dest) {

        dest.plugins[name] = dest.plugins[name] || {};
        if (key) {
            dest.plugins[name][key] = value;
        }
        else {
            Hoek.merge(dest.plugins[name], value);
        }
    });
};


internals.Plugin.prototype.route = function (options) {

    internals.applySync(this._selection.servers, Server.prototype._route, [options, this._env]);
};


internals.Plugin.prototype.state = function () {

    internals.applySync(this._selection.servers, Server.prototype.state, arguments);
};


internals.Plugin.prototype.ext = function () {

    internals.applySync(this._selection.servers, Server.prototype._ext, [arguments[0], arguments[1], arguments[2], this._env]);
};


internals.Plugin.prototype.dependency = function (deps, after) {

    Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

    deps = [].concat(deps);
    this._pack._dependencies.push({ plugin: this._env.name, servers: this._selection.servers, deps: deps });

    if (after) {
        this._after(after, deps);
    }
};


internals.Plugin.prototype._after = function (func, after) {

    this._pack._afters = this._pack._afters || new Topo();
    this._pack._afters.add({ func: func, plugin: this }, { after: after, group: this._env.name });
};


internals.Plugin.prototype.register = function (plugins /*, [options], callback */) {

    var options = (typeof arguments[1] === 'object' ? arguments[1] : {});
    var callback = (typeof arguments[1] === 'object' ? arguments[2] : arguments[1]);

    if (this._env.route.prefix ||
        this._env.route.vhost) {

        options = Hoek.clone(options);
        options.route = options.route || {};

        options.route.prefix = (this._env.route.prefix || '') + (options.route.prefix || '') || undefined;
        options.route.vhost = this._env.route.vhost || options.route.vhost;
    }

    this._pack._register(plugins, options, this._selection.index, callback);
};


internals.Plugin.prototype.log = function (tags, data, timestamp) {

    this._pack.log(tags, data, timestamp);
};


internals.Plugin.prototype.after = function (func) {

    this._after(func);
};


internals.Plugin.prototype.bind = function (bind) {

    Hoek.assert(typeof bind === 'object', 'bind must be an object');
    this._env.bind = bind;
};


internals.Plugin.prototype.path = function (path) {

    Hoek.assert(path && typeof path === 'string', 'path must be a non-empty string');
    this._env.path = path;
};


internals.Plugin.prototype.views = function (options) {

    Hoek.assert(options, 'Missing views options');
    Hoek.assert(!this._env.views, 'Cannot set plugin views manager more than once');

    if (!options.basePath && this._env.path) {
        options = Utils.shallow(options);
        options.basePath = this._env.path;
    }

    this._env.views = new Vision.Manager(options);
};


internals.Plugin.prototype.render = function (template, context /*, options, callback */) {

    var options = arguments.length === 4 ? arguments[2] : {};
    var callback = arguments.length === 4 ? arguments[3] : arguments[2];

    Hoek.assert(this._env.views, 'Missing plugin views manager');
    return this._env.views.render(template, context, options, callback);
};


internals.Plugin.prototype.method = function (/* name, method, options */) {

    var args = Array.prototype.slice.call(arguments);
    if (args.length === 2) {
        args.push(null);
    }
    args.push(this._env);

    return this._pack._methods.add.apply(this._pack._methods, args);
};


internals.Plugin.prototype.handler = function (/* name, method */) {

    var args = Array.prototype.slice.call(arguments);
    return this._pack._handler.apply(this._pack, args);
};


internals.Plugin.prototype.cache = function (options) {

    return this._pack._provisionCache(options, 'plugin', this._env.name, options.segment);
};


internals.Plugin.prototype._select = function (labels, subset) {

    var self = this;

    Hoek.assert(!labels || typeof labels === 'string' || Array.isArray(labels), 'Bad labels object type (undefined or array required)');
    labels = labels && [].concat(labels);

    var ids = [];
    if (labels) {
        labels.forEach(function (label) {

            ids = ids.concat(self._pack._byLabel[label] || []);
        });

        ids = Hoek.unique(ids);
    }
    else {
        ids = Object.keys(this._pack._byId);
    }

    var result = {
        servers: [],
        index: {}
    };

    ids.forEach(function (id) {

        if (!subset ||
            subset[id]) {

            result.servers.push(self._pack._byId[id]);
            result.index[id] = true;
        }
    });

    return result;
};


internals.applySync = function (servers, func, args) {

    for (var i = 0, il = servers.length; i < il; ++i) {
        func.apply(servers[i], args);
    }
};


internals.applyChildSync = function (servers, child, func, args) {

    for (var i = 0, il = servers.length; i < il; ++i) {
        var obj = servers[i][child];
        obj[func].apply(obj, args);
    }
};
