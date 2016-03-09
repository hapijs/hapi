'use strict';

// Load modules

const Events = require('events');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const Heavy = require('heavy');
const Hoek = require('hoek');
const Items = require('items');
const Mimos = require('mimos');
const Connection = require('./connection');
const Defaults = require('./defaults');
const Ext = require('./ext');
const Methods = require('./methods');
const Plugin = require('./plugin');
const Promises = require('./promises');
const Reply = require('./reply');
const Request = require('./request');
const Schema = require('./schema');


// Declare internals

const internals = {};


exports = module.exports = internals.Server = function (options) {

    Hoek.assert(this instanceof internals.Server, 'Server must be instantiated using new');

    options = Schema.apply('server', options || {});

    this._settings = Hoek.applyToDefaultsWithShallow(Defaults.server, options, ['connections.routes.bind']);
    this._settings.connections = Hoek.applyToDefaultsWithShallow(Defaults.connection, this._settings.connections || {}, ['routes.bind']);
    this._settings.connections.routes.cors = Hoek.applyToDefaults(Defaults.cors, this._settings.connections.routes.cors);
    this._settings.connections.routes.security = Hoek.applyToDefaults(Defaults.security, this._settings.connections.routes.security);

    this._caches = {};                                                  // Cache clients
    this._handlers = {};                                                // Registered handlers
    this._methods = new Methods(this);                                  // Server methods

    this._events = new Events.EventEmitter();                           // Server-only events
    this._dependencies = [];                                            // Plugin dependencies
    this._registrations = {};                                           // Tracks plugins registered before connection added
    this._heavy = new Heavy(this._settings.load);
    this._mime = new Mimos(this._settings.mime);
    this._replier = new Reply();
    this._requestor = new Request();
    this._decorations = {};
    this._plugins = {};                                                 // Exposed plugin properties by name
    this._app = {};
    this._registring = false;                                           // true while register() is waiting for plugin callbacks
    this._state = 'stopped';                                            // 'stopped', 'initializing', 'initialized', 'starting', 'started', 'stopping', 'invalid'

    this._extensionsSeq = 0;                                            // Used to keep absolute order of extensions based on the order added across locations
    this._extensions = {
        onPreStart: new Ext(this),
        onPostStart: new Ext(this),
        onPreStop: new Ext(this),
        onPostStop: new Ext(this)
    };

    if (options.cache) {
        this._createCache(options.cache);
    }

    if (!this._caches._default) {
        this._createCache([{ engine: CatboxMemory }]);                  // Defaults to memory-based
    }

    Plugin.call(this, this, [], '', null);
};

Hoek.inherits(internals.Server, Plugin);


internals.Server.prototype._createCache = function (options, _callback) {

    Hoek.assert(this._state !== 'initializing', 'Cannot provision server cache while server is initializing');

    options = Schema.apply('cache', options);

    const added = [];
    for (let i = 0; i < options.length; ++i) {
        let config = options[i];
        if (typeof config === 'function') {
            config = { engine: config };
        }

        const name = config.name || '_default';
        Hoek.assert(!this._caches[name], 'Cannot configure the same cache more than once: ', name === '_default' ? 'default cache' : name);

        let client = null;
        if (typeof config.engine === 'object') {
            client = new Catbox.Client(config.engine);
        }
        else {
            const settings = Hoek.clone(config);
            settings.partition = settings.partition || 'hapi-cache';
            delete settings.name;
            delete settings.engine;
            delete settings.shared;

            client = new Catbox.Client(config.engine, settings);
        }

        this._caches[name] = {
            client: client,
            segments: {},
            shared: config.shared || false
        };

        added.push(client);
    }

    if (!_callback) {
        return;
    }

    // Start cache

    if (['initialized', 'starting', 'started'].indexOf(this._state) !== -1) {
        const each = (client, next) => client.start(next);
        return Items.parallel(added, each, _callback);
    }

    return Hoek.nextTick(_callback)();
};


internals.Server.prototype.connection = function (options) {

    const root = this.root;                                   // Explicitly use the root reference (for plugin invocation)

    let settings = Hoek.applyToDefaultsWithShallow(root._settings.connections, options || {}, ['listener', 'routes.bind']);
    settings.routes.cors = Hoek.applyToDefaults(root._settings.connections.routes.cors || Defaults.cors, settings.routes.cors) || false;
    settings.routes.security = Hoek.applyToDefaults(root._settings.connections.routes.security || Defaults.security, settings.routes.security);

    settings = Schema.apply('connection', settings);       // Applies validation changes (type cast)

    const connection = new Connection(root, settings);
    root.connections.push(connection);
    root.addEmitter(connection);
    root._single();

    const registrations = Object.keys(root._registrations);
    for (let i = 0; i < registrations.length; ++i) {
        const name = registrations[i];
        connection.registrations[name] = root._registrations[name];
    }

    return this._clone([connection]);                       // Use this for active realm
};


internals.Server.prototype.start = function (callback) {

    if (!callback) {
        return Promises.wrap(this, this.start);
    }

    Hoek.assert(typeof callback === 'function', 'Missing required start callback function');

    if (this._state === 'initialized') {
        return this._start(callback);
    }

    if (this._state === 'started') {
        Items.serial(this.connections, (connectionItem, next) => {

            connectionItem._start(next);
        }, callback);

        return;
    }

    if (this._state !== 'stopped') {
        return Hoek.nextTick(callback)(new Error('Cannot start server while it is in ' + this._state + ' state'));
    }

    this.initialize((err) => {

        if (err) {
            return callback(err);
        }

        this._start(callback);
    });
};


internals.Server.prototype.initialize = function (callback) {

    if (!callback) {
        return Promises.wrap(this, this.initialize);
    }

    const nextTickCallback = Hoek.nextTick(callback);
    if (!this.connections.length) {
        return nextTickCallback(new Error('No connections to start'));
    }

    if (this._registring) {
        return nextTickCallback(new Error('Cannot start server before plugins finished registration'));
    }

    if (this._state === 'initialized') {
        return nextTickCallback();
    }

    if (this._state !== 'stopped') {
        return nextTickCallback(new Error('Cannot initialize server while it is in ' + this._state + ' state'));
    }

    // Assert dependencies

    for (let i = 0; i < this._dependencies.length; ++i) {
        const dependency = this._dependencies[i];
        if (dependency.connections) {
            for (let j = 0; j < dependency.connections.length; ++j) {
                const connection = dependency.connections[j];
                for (let k = 0; k < dependency.deps.length; ++k) {
                    const dep = dependency.deps[k];
                    if (!connection.registrations[dep]) {
                        return nextTickCallback(new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep + ' in connection: ' + connection.info.uri));
                    }
                }
            }
        }
        else {
            for (let j = 0; j < dependency.deps.length; ++j) {
                const dep = dependency.deps[j];
                if (!this._registrations[dep]) {
                    return nextTickCallback(new Error('Plugin ' + dependency.plugin + ' missing dependency ' + dep));
                }
            }
        }
    }

    this._state = 'initializing';

    // Start cache

    const each = (cache, next) => {

        this._caches[cache].client.start(next);
    };

    const caches = Object.keys(this._caches);
    Items.parallel(caches, each, (err) => {

        if (err) {
            this._state = 'invalid';
            return callback(err);
        }

        // After hooks

        this._invoke('onPreStart', (err) => {

            if (err) {
                this._state = 'invalid';
                return callback(err);
            }

            // Load measurements

            this._heavy.start();

            // Listen to connections

            this._state = 'initialized';
            return callback();
        });
    });
};


internals.Server.prototype._start = function (callback) {

    this._state = 'starting';

    const each = (connectionItem, next) => {

        connectionItem._start(next);
    };

    Items.serial(this.connections, each, (err) => {

        if (err) {
            this._state = 'invalid';
            return callback(err);
        }

        this._events.emit('start');
        this._invoke('onPostStart', (err) => {

            if (err) {
                this._state = 'invalid';
                return callback(err);
            }

            this._state = 'started';
            return callback();
        });
    });
};


internals.Server.prototype.stop = function (/* [options], callback */) {

    const args = arguments.length;
    const lastArg = arguments[args - 1];
    const callback = (!args ? null : (typeof lastArg === 'function' ? lastArg : null));
    const options = (!args ? {} : (args === 1 ? (callback ? {} : arguments[0]) : arguments[0]));

    if (!callback) {
        return Promises.wrap(this, this.stop, [options]);
    }

    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (['stopped', 'initialized', 'started', 'invalid'].indexOf(this._state) === -1) {
        return Hoek.nextTick(callback)(new Error('Cannot stop server while in ' + this._state + ' state'));
    }

    this._state = 'stopping';

    this._invoke('onPreStop', (err) => {

        if (err) {
            this._state = 'invalid';
            return callback(err);
        }

        const each = (connection, next) => {

            connection._stop(options, next);
        };

        Items.serial(this.connections, each, (err) => {

            if (err) {
                this._state = 'invalid';
                return callback(err);
            }

            const caches = Object.keys(this._caches);
            for (let i = 0; i < caches.length; ++i) {
                this._caches[caches[i]].client.stop();
            }

            this._events.emit('stop');
            this._heavy.stop();
            this._invoke('onPostStop', (err) => {

                if (err) {
                    this._state = 'invalid';
                    return callback(err);
                }

                this._state = 'stopped';
                return callback();
            });
        });
    });
};


internals.Server.prototype._invoke = function (type, next) {

    const exts = this._extensions[type];
    if (!exts.nodes) {
        return next();
    }

    Items.serial(exts.nodes, (ext, nextExt) => {

        const bind = (ext.bind || ext.plugin.realm.settings.bind);
        ext.func.call(bind, ext.plugin._select(), nextExt);
    }, next);
};
