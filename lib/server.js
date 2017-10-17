'use strict';

// Load modules

const Hoek = require('hoek');
const Shot = require('shot');

const Config = require('./config');
const Core = require('./core');
const Ext = require('./ext');
const Package = require('../package.json');
const Route = require('./route');


// Declare internals

const internals = {};


exports = module.exports = function (options) {

    const core = new Core(options);
    return new internals.Server(core);
};


internals.Server = class {

    constructor(core, name, parent) {

        this._core = core;

        // Public interface

        this.app = core.app;
        this.auth = Object.create(this._core.auth);
        this.auth.strategy = this.auth._strategy.bind(this.auth, this);
        this.decorations = core.decorations;
        this.cache = internals.cache(this);
        this.events = core.events;
        this.info = core.info;
        this.listener = core.listener;
        this.load = core.heavy.load;
        this.methods = core.methods.methods;
        this.mime = core.mime;
        this.plugins = core.plugins;
        this.registrations = core.registrations;
        this.settings = core.settings;
        this.states = core.states;
        this.type = core.type;
        this.version = Package.version;

        this.realm = {
            _extensions: {
                onPreAuth: new Ext('onPreAuth', core),
                onPostAuth: new Ext('onPostAuth', core),
                onPreHandler: new Ext('onPreHandler', core),
                onPostHandler: new Ext('onPostHandler', core),
                onPreResponse: new Ext('onPreResponse', core)
            },
            modifiers: {
                route: {}
            },
            parent: (parent ? parent.realm : null),
            plugin: name,
            pluginOptions: {},
            plugins: {},
            settings: {
                bind: undefined,
                files: {
                    relativeTo: undefined
                }
            }
        };

        // Decorations

        const methods = Object.keys(core.serverDecorations);
        for (let i = 0; i < methods.length; ++i) {
            const method = methods[i];
            this[method] = core.serverDecorations[method];
        }

        core.registerServer(this);
    }

    _clone(name) {

        return new internals.Server(this._core, name, this);
    }

    async register(plugins, options = {}) {

        if (this.realm.modifiers.route.prefix ||
            this.realm.modifiers.route.vhost) {

            options = Hoek.clone(options);
            options.routes = options.routes || {};

            options.routes.prefix = (this.realm.modifiers.route.prefix || '') + (options.routes.prefix || '') || undefined;
            options.routes.vhost = this.realm.modifiers.route.vhost || options.routes.vhost;
        }

        options = Config.apply('register', options);

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

            plugin = Config.apply('plugin', plugin);

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

        this._core.registring = true;

        for (let i = 0; i < registrations.length; ++i) {
            const item = registrations[i];
            const clone = this._clone(item.name);
            clone.realm.modifiers.route.prefix = item.options.routes.prefix;
            clone.realm.modifiers.route.vhost = item.options.routes.vhost;
            clone.realm.pluginOptions = item.pluginOptions || {};

            // Protect against multiple registrations

            if (this._core.registrations[item.name]) {
                if (item.options.once) {
                    continue;
                }

                Hoek.assert(item.multiple, 'Plugin', item.name, 'already registered');
            }
            else {
                this._core.registrations[item.name] = {
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

        this._core.registring = false;
    }

    bind(context) {

        Hoek.assert(typeof context === 'object', 'bind must be an object');
        this.realm.settings.bind = context;
    }

    decoder(encoding, decoder) {

        return this._core.compression.addDecoder(encoding, decoder);
    }

    decorate(type, property, method, options) {

        Hoek.assert(this._core.decorations[type], 'Unknown decoration type:', type);
        Hoek.assert(property, 'Missing decoration property name');
        Hoek.assert(typeof property === 'string', 'Decoration property must be a string');
        Hoek.assert(property[0] !== '_', 'Property name cannot begin with an underscore:', property);
        Hoek.assert(!options || type === 'request', 'Cannot specify options for non-request decoration');

        // Handler

        if (type === 'handler') {
            Hoek.assert(!this._core.handlers[property], 'Handler name already exists:', property);
            Hoek.assert(typeof method === 'function', 'Handler must be a function:', property);
            Hoek.assert(!method.defaults || typeof method.defaults === 'object' || typeof method.defaults === 'function', 'Handler defaults property must be an object or function');

            this._core.handlers[property] = method;
            this._core.decorations.handler.push(property);
        }

        // Request

        if (type === 'request') {
            this._core.requestor.decorate(property, method, options);
            this._core.decorations.request.push(property);
            return;
        }

        // Toolkit

        if (type === 'toolkit') {
            this._core.toolkit.decorate(property, method);
            this._core.decorations.toolkit.push(property);
            return;
        }

        // Server

        Hoek.assert(!this._core.serverDecorations[property], 'Server decoration already defined:', property);
        Hoek.assert(this[property] === undefined && this._core[property] === undefined, 'Cannot override the built-in server interface method:', property);

        this._core.serverDecorations[property] = method;
        this._core.decorations.server.push(property);
        this._core.instances.forEach((server) => {

            server[property] = method;
        });
    }

    dependency(dependencies, after) {

        Hoek.assert(this.realm.plugin, 'Cannot call dependency() outside of a plugin');
        Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

        dependencies = [].concat(dependencies);
        this._core.dependencies.push({ plugin: this.realm.plugin, deps: dependencies });

        if (after) {
            this.ext('onPreStart', after, { after: dependencies });
        }
    }

    encoder(encoding, encoder) {

        return this._core.compression.addEncoder(encoding, encoder);
    }

    event(event) {

        this._core.events.registerEvent(event);
    }

    expose(key, value) {

        Hoek.assert(this.realm.plugin, 'Cannot call expose() outside of a plugin');

        const plugin = this.realm.plugin;
        this._core.plugins[plugin] = this._core.plugins[plugin] || {};

        if (typeof key === 'string') {
            this._core.plugins[plugin][key] = value;
        }
        else {
            Hoek.merge(this._core.plugins[plugin], key);
        }
    }

    ext(events, method, options) {        // (event, method, options) -OR- (events)

        if (typeof events === 'string') {
            events = { type: events, method, options };
        }

        events = Config.apply('exts', events);

        for (let i = 0; i < events.length; ++i) {
            this._ext(events[i]);
        }
    }

    _ext(event) {

        event = Hoek.shallow(event);
        event.realm = this.realm;
        const type = event.type;

        if (!this._core.extensions.server[type]) {

            // Realm route extensions

            if (event.options.sandbox === 'plugin') {
                Hoek.assert(this.realm._extensions[type], 'Unknown event type', type);
                return this.realm._extensions[type].add(event);
            }

            // Connection route extensions

            Hoek.assert(this._core.extensions.route[type], 'Unknown event type', type);
            return this._core.extensions.route[type].add(event);
        }

        // Server extensions

        Hoek.assert(!event.options.sandbox, 'Cannot specify sandbox option for server extension');
        Hoek.assert(type !== 'onPreStart' || this._core.phase === 'stopped', 'Cannot add onPreStart (after) extension after the server was initialized');

        event.server = this;
        this._core.extensions.server[type].add(event);
    }

    async inject(options) {

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

            settings.authority = settings.authority || (this._core.info.host + ':' + this._core.info.port);
        }

        const needle = this._core._dispatch({
            credentials: options.credentials,
            artifacts: options.artifacts,
            allowInternals: options.allowInternals,
            app: options.app,
            plugins: options.plugins
        });

        const res = await Shot.inject(needle, settings);
        const custom = res.raw.res[Config.symbol];
        if (custom) {
            res.result = custom.result;
            res.request = custom.request;
            delete res.raw.res[Config.symbol];
        }

        if (res.result === undefined) {
            res.result = res.payload;
        }

        return res;
    }

    log(tags, data, timestamp) {

        return this._core.log(tags, data, timestamp);
    }

    lookup(id) {

        Hoek.assert(id && typeof id === 'string', 'Invalid route id:', id);

        const record = this._core.router.ids[id];
        if (!record) {
            return null;
        }

        return record.route.public;
    }

    match(method, path, host) {

        Hoek.assert(method && typeof method === 'string', 'Invalid method:', method);
        Hoek.assert(path && typeof path === 'string' && path[0] === '/', 'Invalid path:', path);
        Hoek.assert(!host || typeof host === 'string', 'Invalid host:', host);

        const match = this._core.router.route(method.toLowerCase(), path, host);
        Hoek.assert(match !== this._core.router.specials.badRequest, 'Invalid path:', path);
        if (match === this._core.router.specials.notFound) {
            return null;
        }

        return match.route.public;
    }

    method(name, method, options) {

        return this._core.methods.add(name, method, options, this.realm);
    }

    path(relativeTo) {

        Hoek.assert(relativeTo && typeof relativeTo === 'string', 'relativeTo must be a non-empty string');
        this.realm.settings.files.relativeTo = relativeTo;
    }

    route(options) {

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
    }

    _addRoute(config, server) {

        const route = new Route(config, server);                        // Do no use config beyond this point, use route members
        const vhosts = [].concat(route.settings.vhost || '*');

        for (let i = 0; i < vhosts.length; ++i) {
            const vhost = vhosts[i];
            const record = this._core.router.add({ method: route.method, path: route.path, vhost, analysis: route._analysis, id: route.settings.id }, route);
            route.fingerprint = record.fingerprint;
            route.params = record.params;
        }

        this.events.emit('route', [route.public, server]);
    }

    state(name, options) {

        this.states.add(name, options);
    }

    table(host) {

        return this._core.router.table(host);
    }

    start() {

        return this._core._start();
    }

    initialize() {

        return this._core._initialize();
    }

    stop(options) {

        return this._core._stop(options);
    }
};


internals.cache = (plugin) => {

    const policy = function (options, _segment) {

        return this._core._cachePolicy(options, _segment, plugin.realm);
    };

    policy.provision = async (opts) => {

        const clients = plugin._core._createCache(opts);

        // Start cache

        if (['initialized', 'starting', 'started'].indexOf(plugin._core.phase) !== -1) {
            await Promise.all(clients.map((client) => client.start()));
        }
    };

    return policy;
};
