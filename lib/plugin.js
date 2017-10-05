'use strict';

// Load modules

const Catbox = require('catbox');
const Hoek = require('hoek');
const Shot = require('shot');

const Ext = require('./ext');
const Package = require('../package.json');
const Route = require('./route');
const Schema = require('./schema');


// Declare internals

const internals = {};


exports = module.exports = internals.Plugin = function (server, env, parent) {         // env can be a realm or plugin name

    this._parent = parent;

    // Public interface

    this.root = server;
    this.app = this.root._app;
    this.auth = this.root._auth;
    this.events = this.root._events;
    this.info = this.root._info;
    this.listener = this.root._listener;
    this.load = this.root._heavy.load;
    this.methods = this.root._methods.methods;
    this.mime = this.root._mime;
    this.plugins = this.root._plugins;
    this.registrations = this.root._registrations;
    this.settings = this.root._settings;
    this.states = this.root._states;
    this.version = Package.version;

    this.realm = typeof env !== 'string' ? env : {
        _extensions: {
            onPreAuth: new Ext('onPreAuth', this.root),
            onPostAuth: new Ext('onPostAuth', this.root),
            onPreHandler: new Ext('onPreHandler', this.root),
            onPostHandler: new Ext('onPostHandler', this.root),
            onPreResponse: new Ext('onPreResponse', this.root)
        },
        modifiers: {
            route: {}
        },
        plugin: env,
        pluginOptions: {},
        plugins: {},
        settings: {
            bind: undefined,
            files: {
                relativeTo: undefined
            }
        }
    };

    this.cache = internals.cache(this);

    // Decorations

    const methods = Object.keys(this.root._decorations);
    for (let i = 0; i < methods.length; ++i) {
        const method = methods[i];
        this[method] = this.root._decorations[method];
    }
};


internals.Plugin.prototype._clone = function (plugin) {

    const env = (plugin !== undefined ? plugin : this.realm);                     // Allow empty string
    return new internals.Plugin(this.root, env, this);
};


internals.Plugin.prototype.register = async function (plugins, options = {}) {

    if (this.realm.modifiers.route.prefix ||
        this.realm.modifiers.route.vhost) {

        options = Hoek.clone(options);
        options.routes = options.routes || {};

        options.routes.prefix = (this.realm.modifiers.route.prefix || '') + (options.routes.prefix || '') || undefined;
        options.routes.vhost = this.realm.modifiers.route.vhost || options.routes.vhost;
    }

    options = Schema.apply('register', options);

    /*
        const register = async function (server, options) { };
        register.attributes = {
            pkg: require('../package.json'),
            name: 'plugin',
            version: '1.1.1',
            multiple: false,
            dependencies: [],
            once: true
        };

        const item = {
            register: register,
            options: options        // -optional--
        };

        - OR -

        const item = function () {}
        item.register = register;
        item.options = options;

        const plugins = register, items, [register, item]
    */

    const registrations = [];
    plugins = [].concat(plugins);
    for (let i = 0; i < plugins.length; ++i) {
        let plugin = plugins[i];

        if (typeof plugin === 'function') {
            if (!plugin.register) {                                 // plugin is register() function
                plugin = { register: plugin };
            }
            else {
                plugin = Hoek.shallow(plugin);                      // Convert function to object
            }
        }

        if (plugin.register.register) {                             // Required plugin
            plugin.register = plugin.register.register;
        }

        plugin = Schema.apply('plugin', plugin);

        const attributes = plugin.register.attributes;
        const registration = {
            register: plugin.register,
            name: attributes.name || attributes.pkg.name,
            version: attributes.version || attributes.pkg.version,
            multiple: attributes.multiple,
            pluginOptions: plugin.options,
            dependencies: attributes.dependencies,
            options: {
                once: attributes.once || (plugin.once !== undefined ? plugin.once : options.once),
                routes: {
                    prefix: plugin.routes.prefix || options.routes.prefix,
                    vhost: plugin.routes.vhost || options.routes.vhost
                }
            }
        };

        registrations.push(registration);
    }

    this.root._registring = true;

    for (let i = 0; i < registrations.length; ++i) {
        const item = registrations[i];
        const clone = this._clone(item.name);
        clone.realm.modifiers.route.prefix = item.options.routes.prefix;
        clone.realm.modifiers.route.vhost = item.options.routes.vhost;
        clone.realm.pluginOptions = item.pluginOptions || {};

        // Protect against multiple registrations

        if (this.root._registrations[item.name]) {
            if (item.options.once) {
                continue;
            }

            Hoek.assert(item.multiple, 'Plugin', item.name, 'already registered');
        }
        else {
            this.root._registrations[item.name] = {
                version: item.version,
                name: item.name,
                options: item.pluginOptions,
                attributes: item.register.attributes
            };
        }

        if (item.dependencies) {
            clone.dependency(item.dependencies);
        }

        // Register

        await item.register(clone, item.pluginOptions || {});
    };

    this.root._registring = false;
};


internals.Plugin.prototype.bind = function (context) {

    Hoek.assert(typeof context === 'object', 'bind must be an object');
    this.realm.settings.bind = context;
};


internals.cache = (plugin) => {

    const policy = function (options, _segment) {

        options = Schema.apply('cachePolicy', options);

        const segment = options.segment || _segment || (plugin.realm.plugin ? '!' + plugin.realm.plugin : '');
        Hoek.assert(segment, 'Missing cache segment name');

        const cacheName = options.cache || '_default';
        const cache = plugin.root._caches[cacheName];
        Hoek.assert(cache, 'Unknown cache', cacheName);
        Hoek.assert(!cache.segments[segment] || cache.shared || options.shared, 'Cannot provision the same cache segment more than once');
        cache.segments[segment] = true;

        return new Catbox.Policy(options, cache.client, segment);
    };

    policy.provision = async (opts) => {

        const clients = plugin.root._createCache(opts);

        // Start cache

        if (['initialized', 'starting', 'started'].indexOf(plugin.root._phase) !== -1) {
            await Promise.all(clients.map((client) => client.start()));
        }
    };

    return policy;
};


internals.Plugin.prototype.decoder = function (encoding, decoder) {

    return this.root._compression.addDecoder(encoding, decoder);
};


internals.Plugin.prototype.decorate = function (type, property, method, options) {

    Hoek.assert(['responder', 'request', 'server'].indexOf(type) !== -1, 'Unknown decoration type:', type);
    Hoek.assert(property, 'Missing decoration property name');
    Hoek.assert(typeof property === 'string', 'Decoration property must be a string');
    Hoek.assert(property[0] !== '_', 'Property name cannot begin with an underscore:', property);

    // Request

    if (type === 'request') {
        this.root._requestor.decorate(property, method, options);
        this.root.decorations.request.push(property);
        return;
    }

    Hoek.assert(!options, 'Cannot specify options for non-request decoration');

    // Responder

    if (type === 'responder') {
        this.root._responder.decorate(property, method);
        this.root.decorations.responder.push(property);
        return;
    }

    // Server

    Hoek.assert(!this.root._decorations[property], 'Server decoration already defined:', property);
    Hoek.assert(this[property] === undefined && this.root[property] === undefined, 'Cannot override the built-in server interface method:', property);

    this.root._decorations[property] = method;
    this.root.decorations.server.push(property);

    this[property] = method;
    let parent = this._parent;
    while (parent) {
        parent[property] = method;
        parent = parent._parent;
    }
};

internals.Plugin.prototype.dependency = function (dependencies, after) {

    Hoek.assert(this.realm.plugin, 'Cannot call dependency() outside of a plugin');
    Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

    dependencies = [].concat(dependencies);
    this.root._dependencies.push({ plugin: this.realm.plugin, deps: dependencies });

    if (after) {
        this.ext('onPreStart', after, { after: dependencies });
    }
};


internals.Plugin.prototype.encoder = function (encoding, encoder) {

    return this.root._compression.addEncoder(encoding, encoder);
};


internals.Plugin.prototype.event = function (event) {

    this.root._events.registerEvent(event);
};


internals.Plugin.prototype.expose = function (key, value) {

    Hoek.assert(this.realm.plugin, 'Cannot call expose() outside of a plugin');

    const plugin = this.realm.plugin;
    this.root.plugins[plugin] = this.root.plugins[plugin] || {};

    if (typeof key === 'string') {
        this.root.plugins[plugin][key] = value;
    }
    else {
        Hoek.merge(this.root.plugins[plugin], key);
    }
};


internals.Plugin.prototype.ext = function (events, method, options) {        // (event, method, options) -OR- (events)

    if (typeof events === 'string') {
        events = { type: events, method, options };
    }

    events = Schema.apply('exts', events);

    for (let i = 0; i < events.length; ++i) {
        this._ext(events[i]);
    }
};


internals.Plugin.prototype._ext = function (event) {

    event = Hoek.shallow(event);
    event.plugin = this;
    const type = event.type;

    if (!this.root._extensions.server[type]) {

        // Realm route extensions

        if (event.options.sandbox === 'plugin') {
            Hoek.assert(this.realm._extensions[type], 'Unknown event type', type);
            return this.realm._extensions[type].add(event);
        }

        // Connection route extensions

        Hoek.assert(this.root._extensions.route[type], 'Unknown event type', type);
        return this.root._extensions.route[type].add(event);
    }

    // Server extensions

    Hoek.assert(!event.options.sandbox, 'Cannot specify sandbox option for server extension');
    Hoek.assert(type !== 'onPreStart' || this.root._phase === 'stopped', 'Cannot add onPreStart (after) extension after the server was initialized');
    this.root._extensions.server[type].add(event);
};


internals.Plugin.prototype.handler = function (name, method) {

    Hoek.assert(typeof name === 'string', 'Invalid handler name');
    Hoek.assert(!this.root._handlers[name], 'Handler name already exists:', name);
    Hoek.assert(typeof method === 'function', 'Handler must be a function:', name);
    Hoek.assert(!method.defaults || typeof method.defaults === 'object' || typeof method.defaults === 'function', 'Handler defaults property must be an object or function');
    this.root._handlers[name] = method;
};


internals.Plugin._symbol = Symbol('hapi-response');


internals.Plugin.prototype.inject = async function (options) {

    let settings = options;
    if (typeof settings === 'string') {
        settings = { url: settings };
    }

    if (!settings.authority ||
        settings.credentials ||
        settings.app ||
        settings.plugins ||
        settings.allowInternals !== undefined) {        // Can be false

        settings = Hoek.shallow(settings);              // options can be reused
        delete settings.credentials;
        delete settings.artifacts;                      // Cannot appear without credentials
        delete settings.app;
        delete settings.plugins;
        delete settings.allowInternals;

        settings.authority = settings.authority || (this.root._info.host + ':' + this.root._info.port);
    }

    const needle = this.root._dispatch({
        credentials: options.credentials,
        artifacts: options.artifacts,
        allowInternals: options.allowInternals,
        app: options.app,
        plugins: options.plugins
    });

    const res = await Shot.inject(needle, settings);
    const custom = res.raw.res[internals.Plugin._symbol];
    if (custom) {
        res.result = custom.result;
        res.request = custom.request;
        delete res.raw.res[internals.Plugin._symbol];
    }

    if (res.result === undefined) {
        res.result = res.payload;
    }

    return res;
};


internals.Plugin.prototype.log = function (tags, data, timestamp, _internal) {

    tags = [].concat(tags);
    timestamp = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
    const internal = !!_internal;

    const update = (typeof data !== 'function' ? { timestamp, tags, data, internal } : () => {

        return { timestamp, tags, data: data(), internal };
    });

    this.events.emit({ name: 'log', tags }, update);
};


internals.Plugin.prototype._log = function (tags, data) {

    return this.log(tags, data, null, true);
};


internals.Plugin.prototype.lookup = function (id) {

    Hoek.assert(id && typeof id === 'string', 'Invalid route id:', id);

    const record = this.root._router.ids[id];
    if (!record) {
        return null;
    }

    return record.route.public;
};


internals.Plugin.prototype.match = function (method, path, host) {

    Hoek.assert(method && typeof method === 'string', 'Invalid method:', method);
    Hoek.assert(path && typeof path === 'string' && path[0] === '/', 'Invalid path:', path);
    Hoek.assert(!host || typeof host === 'string', 'Invalid host:', host);

    const match = this.root._router.route(method.toLowerCase(), path, host);
    Hoek.assert(match !== this.root._router.specials.badRequest, 'Invalid path:', path);
    if (match === this.root._router.specials.notFound) {
        return null;
    }

    return match.route.public;
};


internals.Plugin.prototype.method = function (name, method, options) {

    return this.root._methods.add(name, method, options, this.realm);
};


internals.Plugin.prototype.path = function (relativeTo) {

    Hoek.assert(relativeTo && typeof relativeTo === 'string', 'relativeTo must be a non-empty string');
    this.realm.settings.files.relativeTo = relativeTo;
};


internals.Plugin.prototype.route = function (options) {

    Hoek.assert(typeof options === 'object', 'Invalid route options');

    options = [].concat(options);
    for (let i = 0; i < options.length; ++i) {
        const config = options[i];

        if (Array.isArray(config.method)) {
            for (let j = 0; j < config.method.length; ++j) {
                const method = config.method[j];

                const settings = Hoek.shallow(config);
                settings.method = method;
                this._addRoute(settings, this);
            }
        }
        else {
            this._addRoute(config, this);
        }
    }
};


internals.Plugin.prototype._addRoute = function (config, plugin) {

    const route = new Route(config, plugin);                    // Do no use config beyond this point, use route members
    const vhosts = [].concat(route.settings.vhost || '*');

    for (let i = 0; i < vhosts.length; ++i) {
        const vhost = vhosts[i];
        const record = this.root._router.add({ method: route.method, path: route.path, vhost, analysis: route._analysis, id: route.settings.id }, route);
        route.fingerprint = record.fingerprint;
        route.params = record.params;
    }

    this.events.emit('route', [route.public, plugin]);
};


internals.Plugin.prototype.state = function (name, options) {

    this.root.states.add(name, options);
};


internals.Plugin.prototype.table = function (host) {

    return [{ info: this.root._info, table: this.root._router.table(host) }];
};
