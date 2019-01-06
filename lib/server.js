'use strict';

const Hoek = require('hoek');
const Joi = require('joi');
const Shot = require('shot');
const Somever = require('somever');

const Config = require('./config');
const Core = require('./core');
const Cors = require('./cors');
const Ext = require('./ext');
const Package = require('../package.json');
const Request = require('./request');
const Route = require('./route');


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
                onCredentials: new Ext('onCredentials', core),
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
            _rules: null,
            settings: {
                bind: undefined,
                files: {
                    relativeTo: undefined
                }
            }
        };

        // Decorations

        for (const method of core.decorations.server) {
            this[method] = core._decorations.server[method];
        }

        core.registerServer(this);
    }

    _clone(name) {

        return new internals.Server(this._core, name, this);
    }

    bind(context) {

        Hoek.assert(typeof context === 'object', 'bind must be an object');
        this.realm.settings.bind = context;
    }

    control(server) {

        Hoek.assert(server instanceof internals.Server, 'Can only control Server objects');

        this._core.controlled = this._core.controlled || [];
        this._core.controlled.push(server);
    }

    decoder(encoding, decoder) {

        return this._core.compression.addDecoder(encoding, decoder);
    }

    decorate(type, property, method, options = {}) {

        Hoek.assert(this._core.decorations[type], 'Unknown decoration type:', type);
        Hoek.assert(property, 'Missing decoration property name');
        Hoek.assert(typeof property === 'string' || typeof property === 'symbol', 'Decoration property must be a string or a symbol');

        const propertyName = property.toString();
        Hoek.assert(propertyName[0] !== '_', 'Property name cannot begin with an underscore:', propertyName);

        const existing = this._core._decorations[type][property];
        if (options.extend) {
            Hoek.assert(type !== 'handler', 'Cannot extent handler decoration:', propertyName);
            Hoek.assert(existing, `Cannot extend missing ${type} decoration: ${propertyName}`);
            Hoek.assert(typeof method === 'function', `Extended ${type} decoration method must be a function: ${propertyName}`);

            method = method(existing);
        }
        else {
            Hoek.assert(existing === undefined, `${type[0].toUpperCase() + type.slice(1)} decoration already defined: ${propertyName}`);
        }

        if (type === 'handler') {

            // Handler

            Hoek.assert(typeof method === 'function', 'Handler must be a function:', propertyName);
            Hoek.assert(!method.defaults || typeof method.defaults === 'object' || typeof method.defaults === 'function', 'Handler defaults property must be an object or function');
            Hoek.assert(!options.extend, 'Cannot extend handler decoration:', propertyName);
        }
        else if (type === 'request') {

            // Request

            Hoek.assert(Request.reserved.indexOf(property) === -1, 'Cannot override built-in request interface decoration:', propertyName);

            if (options.apply) {
                this._core._decorations.requestApply = this._core._decorations.requestApply || {};
                this._core._decorations.requestApply[property] = method;
            }
            else {
                this._core.Request.prototype[property] = method;
            }
        }
        else if (type === 'toolkit') {

            // Toolkit

            Hoek.assert(this._core.toolkit.reserved.indexOf(property) === -1, 'Cannot override built-in toolkit decoration:', propertyName);
        }
        else {

            // Server

            if (typeof property === 'string') {
                Hoek.assert(Object.getOwnPropertyNames(internals.Server.prototype).indexOf(property) === -1, 'Cannot override the built-in server interface method:', propertyName);
            }
            else {
                Hoek.assert(Object.getOwnPropertySymbols(internals.Server.prototype).indexOf(property) === -1, 'Cannot override the built-in server interface method:', propertyName);
            }

            this._core.instances.forEach((server) => {

                server[property] = method;
            });
        }

        this._core._decorations[type][property] = method;
        this._core.decorations[type].push(property);
    }

    dependency(dependencies, after) {

        Hoek.assert(this.realm.plugin, 'Cannot call dependency() outside of a plugin');
        Hoek.assert(!after || typeof after === 'function', 'Invalid after method');

        // Normalize to { plugin: version }

        if (typeof dependencies === 'string') {
            dependencies = { [dependencies]: '*' };
        }
        else if (Array.isArray(dependencies)) {
            const map = {};
            for (const dependency of dependencies) {
                map[dependency] = '*';
            }

            dependencies = map;
        }

        this._core.dependencies.push({ plugin: this.realm.plugin, deps: dependencies });

        if (after) {
            this.ext('onPreStart', after, { after: Object.keys(dependencies) });
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
        for (const event of events) {
            this._ext(event);
        }
    }

    _ext(event) {

        event = Object.assign({}, event);       // Shallow cloned
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
            settings.auth ||
            settings.app ||
            settings.plugins ||
            settings.allowInternals !== undefined) {        // Can be false

            settings = Object.assign({}, settings);         // options can be reused (shallow cloned)
            delete settings.auth;
            delete settings.app;
            delete settings.plugins;
            delete settings.allowInternals;

            settings.authority = settings.authority || (this._core.info.host + ':' + this._core.info.port);
        }

        Hoek.assert(!options.credentials, 'options.credentials no longer supported (use options.auth)');

        if (options.auth) {
            Hoek.assert(typeof options.auth === 'object', 'options.auth must be an object');
            Hoek.assert(options.auth.credentials, 'options.auth.credentials is missing');
            Hoek.assert(options.auth.strategy, 'options.auth.strategy is missing');
        }

        const needle = this._core._dispatch({
            auth: options.auth,
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

    log(tags, data) {

        return this._core.log(tags, data);
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

    method(name, method, options = {}) {

        return this._core.methods.add(name, method, options, this.realm);
    }

    path(relativeTo) {

        Hoek.assert(relativeTo && typeof relativeTo === 'string', 'relativeTo must be a non-empty string');
        this.realm.settings.files.relativeTo = relativeTo;
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

        ++this._core.registring;

        try {
            const items = [].concat(plugins);
            for (let item of items) {

                /*
                    { register, ...attributes }
                    { plugin: { register, ...attributes }, options, once, routes }
                    { plugin: { plugin: { register, ...attributes } }, options, once, routes }      // Required module
                */

                if (!item.plugin) {
                    item = {
                        plugin: item
                    };
                }
                else if (!item.plugin.register) {
                    item = {
                        options: item.options,
                        once: item.once,
                        routes: item.routes,
                        plugin: item.plugin.plugin
                    };
                }
                else if (typeof item === 'function') {
                    item = Object.assign({}, item);         // Shallow cloned
                }

                item = Config.apply('plugin', item);

                const name = item.plugin.name || item.plugin.pkg.name;
                const clone = this._clone(name);

                clone.realm.modifiers.route.prefix = item.routes.prefix || options.routes.prefix;
                clone.realm.modifiers.route.vhost = item.routes.vhost || options.routes.vhost;
                clone.realm.pluginOptions = item.options || {};

                // Validate requirements

                const requirements = item.plugin.requirements;
                Hoek.assert(!requirements.node || Somever.match(process.version, requirements.node), 'Plugin', name, 'requires node version', requirements.node, 'but found', process.version);
                Hoek.assert(!requirements.hapi || Somever.match(this.version, requirements.hapi), 'Plugin', name, 'requires hapi version', requirements.hapi, 'but found', this.version);

                // Protect against multiple registrations

                if (this._core.registrations[name]) {
                    if (item.plugin.once ||
                        item.once ||
                        options.once) {

                        continue;
                    }

                    Hoek.assert(item.plugin.multiple, 'Plugin', name, 'already registered');
                }
                else {
                    this._core.registrations[name] = {
                        version: item.plugin.version || item.plugin.pkg.version,
                        name,
                        options: item.options
                    };
                }

                if (item.plugin.dependencies) {
                    clone.dependency(item.plugin.dependencies);
                }

                // Register

                await item.plugin.register(clone, item.options || {});
            }
        }
        catch (err) {
            throw err;
        }
        finally {
            --this._core.registring;
        }
    }

    route(options) {

        Hoek.assert(typeof options === 'object', 'Invalid route options');

        options = [].concat(options);
        for (const config of options) {
            if (Array.isArray(config.method)) {
                for (const method of config.method) {
                    const settings = Object.assign({}, config);     // Shallow cloned
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

        for (const vhost of vhosts) {
            const record = this._core.router.add({ method: route.method, path: route.path, vhost, analysis: route._analysis, id: route.settings.id }, route);
            route.fingerprint = record.fingerprint;
            route.params = record.params;
        }

        this.events.emit('route', route.public);
        Cors.options(route.public, server);
    }

    rules(processor, options = {}) {

        Hoek.assert(!this.realm._rules, 'Server realm rules already defined');

        const settings = Config.apply('rules', options);
        if (settings.validate) {
            const schema = settings.validate.schema;
            settings.validate.schema = Joi.compile(schema);
        }

        this.realm._rules = { processor, settings };
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
