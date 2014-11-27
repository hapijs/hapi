// Load modules

var Catbox = require('catbox');
var Hoek = require('hoek');
var Items = require('items');
var Kilt = require('kilt');
var Topo = require('topo');
var Vision = require('vision');
var Connection = require('./connection');
var Package = require('../package.json');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Plugin = function (server, connections, env, options) {

    var self = this;

    Kilt.call(this, connections, server._events);

    // Validate options

    options = options || {};
    Schema.assert('register', options);

    // Setup environment

    this._server = server;
    this._env = typeof env !== 'string' ? env : {
        plugin: env,
        views: null,
        routes: {
            prefix: options.routes && options.routes.prefix,
            vhost: options.routes && options.routes.vhost
        },
        settings: {
            files: {
                relativeTo: undefined
            },
            bind: undefined
        }
    };

    this.app = this._server._app;
    this.config = { routes: this._env.routes };
    this.connections = connections;
    this.load = this._server._heavy.load;
    this.methods = this._server._methods.methods;
    this.mime = this._server._mime;
    this.plugins = this._server._plugins;
    this.settings = this._server._settings;
    this.version = Package.version;

    this.auth = {
        default: function (options) { self._applyChild('auth', 'default', [options]); },
        scheme: function (name, scheme) { self._applyChild('auth', 'scheme', [name, scheme]); },
        strategy: function (name, scheme, mode, options) { self._applyChild('auth', 'strategy', [name, scheme, mode, options]); },
        test: function (name, request, next) { return request.connection.auth.test(name, request, next); }
    };

    if (this.connections.length === 1) {
        this._single();
    }
    else {
        this.info = null;
        this.inject = null;
        this.listener = null;
    }
};

Hoek.inherits(internals.Plugin, Kilt);


internals.Plugin.prototype._single = function () {

    this.info = this.connections[0].info;
    this.inject = internals.inject;
    this.listener = this.connections[0].listener;
    this.lookup = internals.lookup;
};


internals.Plugin.prototype.select = function (/* labels */) {

    var labels = [];
    for (var i = 0, il = arguments.length; i < il; ++i) {
        labels.push(arguments[i]);
    }

    labels = Hoek.flatten(labels);
    return this._select(labels);
};


internals.Plugin.prototype._select = function (labels, plugin, options) {

    var connections = this.connections;

    if (labels &&
        labels.length) {            // Captures both empty arrays and empty strings

        Hoek.assert(typeof labels === 'string' || Array.isArray(labels), 'Bad labels object type (undefined or array required)');
        labels = [].concat(labels);

        connections = [];
        for (var i = 0, il = this.connections.length; i < il; ++i) {
            var connection = this.connections[i];
            if (Hoek.intersect(connection.settings.labels, labels).length) {
                connections.push(connection);
            }
        }

        if (!plugin &&
            connections.length === this.connections.length) {

            return this;
        }
    }

    return new internals.Plugin(this._server, connections, plugin || this._env, options);
};


internals.Plugin.prototype._clone = function (connections) {

    return new internals.Plugin(this._server, connections, this._env);
};


internals.Plugin.prototype.register = function (plugins /*, [options], callback */) {

    var self = this;

    var options = (typeof arguments[1] === 'object' ? arguments[1] : {});
    var callback = (typeof arguments[1] === 'object' ? arguments[2] : arguments[1]);

    Hoek.assert(typeof callback === 'function', 'A callback function is required to register a plugin');

    if (this._env.routes.prefix ||
        this._env.routes.vhost) {

        options = Hoek.clone(options);
        options.routes = options.routes || {};

        options.routes.prefix = (this._env.routes.prefix || '') + (options.routes.prefix || '') || undefined;
        options.routes.vhost = this._env.routes.vhost || options.routes.vhost;
    }

    /*
        var register = function (server, options, next) { return next(); };
        register.attributes = {
            pkg: require('../package.json'),
            name: 'plugin',
            version: '1.1.1',
            multiple: false
        };

        var item = {
            register: register,
            options: options        // -optional--
        };

        - OR -

        var item = function () {}
        item.register = register;
        item.options = options;

        var plugins = register, items, [register, item]
    */

    var registrations = [];
    plugins = [].concat(plugins);
    for (var i = 0, il = plugins.length; i < il; ++i) {
        var plugin = plugins[i];
        var hint = (plugins.length > 1 ? '(' + i + ')' : '');

        if (typeof plugin === 'function' &&
            !plugin.register) {

            plugin = { register: plugin };
        }

        if (plugin.register.register) {                             // Required plugin
            plugin.register = plugin.register.register;
        }

        Hoek.assert(typeof plugin.register === 'function', 'Invalid plugin object - invalid or missing register function ', hint);
        var attributes = plugin.register.attributes;
        Hoek.assert(typeof plugin.register.attributes === 'object', 'Invalid plugin object - invalid or missing register function attributes property', hint);

        var item = {
            register: plugin.register,
            name: attributes.name || (attributes.pkg && attributes.pkg.name),
            version: attributes.version || (attributes.pkg && attributes.pkg.version) || '0.0.0',
            multiple: attributes.multiple || false,
            options: plugin.options
        };

        Hoek.assert(item.name, 'Missing plugin name', hint);
        registrations.push(item);
    }

    Items.serial(registrations, function (item, next) {

        var selection = self._select(options.select, item.name, options);

        // Protect against multiple registrations

        for (var i = 0, il = selection.connections.length; i < il; ++i) {
            var connection = selection.connections[i];
            Hoek.assert(item.multiple || !connection._registrations[item.name], 'Plugin', item.name, 'already registered in:', connection.info.uri);
            connection._registrations[item.name] = item;
        }

        // Register

        item.register(selection, item.options || {}, next);
    }, callback);
};


internals.Plugin.prototype.after = function (method, dependencies) {

    this._server._afters = this._server._afters || new Topo();
    this._server._afters.add({ func: method, plugin: this }, { after: dependencies, group: this._env.plugin });
};


internals.Plugin.prototype.bind = function (context) {

    Hoek.assert(typeof context === 'object', 'bind must be an object');
    this._env.settings.bind = context;
};


internals.Plugin.prototype.cache = function (options, _segment) {

    Schema.assert('cachePolicy', options);

    var segment = options.segment || _segment || (this._env.plugin ? '!' + this._env.plugin : '');
    Hoek.assert(segment, 'Missing cache segment name');

    var cacheName = options.cache || '_default';
    var cache = this._server._caches[cacheName];
    Hoek.assert(cache, 'Unknown cache', cacheName);
    Hoek.assert(!cache.segments[segment] || cache.shared || options.shared, 'Cannot provision the same cache segment more than once');
    cache.segments[segment] = true;

    return new Catbox.Policy(options, cache.client, segment);
};


internals.Plugin.prototype.decorate = function (type, property, method) {

    Hoek.assert(type === 'reply', 'Unknown decoration type:', type);
    return this._replier.decorate(property, method);
};


internals.Plugin.prototype.dependency = function (dependencies, after) {

    Hoek.assert(this._env.plugin, 'Cannot call dependency() outside of a plugin');
    Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

    dependencies = [].concat(dependencies);
    this._server._dependencies.push({ plugin: this._env.plugin, connections: this.connections, deps: dependencies });

    if (after) {
        this.after(after, dependencies);
    }
};


internals.Plugin.prototype.expose = function (key, value) {

    Hoek.assert(this._env.plugin, 'Cannot call expose() outside of a plugin');

    internals.expose(this.connections, this._env.plugin, key, value);                       // connection.plugins
    if (this.connections.length === this._server.connections.length) {
        internals.expose([this._server], this._env.plugin, key, value);                     // server.plugins
    }
};


internals.expose = function (dests, plugin, key, value) {

    dests.forEach(function (dest) {

        dest.plugins[plugin] = dest.plugins[plugin] || {};
        if (typeof key === 'string') {
            dest.plugins[plugin][key] = value;
        }
        else {
            Hoek.merge(dest.plugins[plugin], key);
        }
    });
};


internals.Plugin.prototype.ext = function (event, func, options) {

    this._apply(Connection.prototype._ext, [event, func, options, this._env]);
};


internals.Plugin.prototype.handler = function (name, method) {

    Hoek.assert(typeof name === 'string', 'Invalid handler name');
    Hoek.assert(!this._server._handlers[name], 'Handler name already exists:', name);
    Hoek.assert(typeof method === 'function', 'Handler must be a function:', name);
    Hoek.assert(!method.defaults || typeof method.defaults === 'object' || typeof method.defaults === 'function', 'Handler defaults property must be an object or function');
    this._server._handlers[name] = method;
};


internals.inject = function (options, callback) {

    return this.connections[0].inject(options, callback);
};


internals.Plugin.prototype.log = function (tags, data, timestamp, _internal) {

    tags = (Array.isArray(tags) ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());

    var event = {
        timestamp: now,
        tags: tags,
        data: data,
        internal: !!_internal
    };

    var tagsMap = Hoek.mapToObject(event.tags);
    this._server._events.emit('log', event, tagsMap);

    if (this._server._settings.debug &&
        this._server._settings.debug.request &&
        Hoek.intersect(tagsMap, this._server._settings.debug.request, true)) {

        console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Hoek.stringify(data) : data)) : ''));
    }
};


internals.Plugin.prototype._log = function (tags, data) {

    return this.log(tags, data, null, true);
};


internals.lookup = function (id) {

    return this.connections[0].lookup(id);
};


internals.Plugin.prototype.method = function (name, method, options) {

    return this._server._methods.add(name, method, options, this._env);
};


internals.Plugin.prototype.path = function (relativeTo) {

    Hoek.assert(relativeTo && typeof relativeTo === 'string', 'relativeTo must be a non-empty string');
    this._env.settings.files.relativeTo = relativeTo;
};


internals.Plugin.prototype.render = function (template, context, options, callback) {

    callback = (typeof callback === 'function' ? callback : options);
    options = (options === callback ? {} : options);

    var viewsManager = this._env.views || this._server._env.views;
    Hoek.assert(viewsManager, 'Missing views manager');
    return viewsManager.render(template, context, options, callback);
};


internals.Plugin.prototype.route = function (options) {

    Hoek.assert(arguments.length === 1, 'Method requires a single object argument or a single array of objects');
    Hoek.assert(typeof options === 'object', 'Invalid route options');

    this._apply(Connection.prototype._route, [options, this._env]);
};


internals.Plugin.prototype.state = function (name, options) {

    this._applyChild('states', 'add', [name, options]);
};


internals.Plugin.prototype.table = function (host) {

    var table = {};
    for (var i = 0, il = this.connections.length; i < il; ++i) {
        var connection = this.connections[i];
        table[connection.info.uri] = connection.table(host);
    }

    return table;
};


internals.Plugin.prototype.views = function (options) {

    Hoek.assert(options, 'Missing views options');
    Hoek.assert(!this._env.views, 'Cannot set views manager more than once');

    if (!options.relativeTo &&
        this._env.settings.files.relativeTo) {

        options = Hoek.shallow(options);
        options.relativeTo = this._env.settings.files.relativeTo;
    }

    this._env.views = new Vision.Manager(options);
};


internals.Plugin.prototype._apply = function (func, args) {

    for (var i = 0, il = this.connections.length; i < il; ++i) {
        func.apply(this.connections[i], args);
    }
};


internals.Plugin.prototype._applyChild = function (child, func, args) {

    for (var i = 0, il = this.connections.length; i < il; ++i) {
        var obj = this.connections[i][child];
        obj[func].apply(obj, args);
    }
};
