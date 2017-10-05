'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

const Schema = require('./schema');


// Declare internals

const internals = {};


exports = module.exports = internals.Methods = function (server) {

    this.server = server;
    this.methods = {};
};


internals.Methods.prototype.add = function (name, method, options, realm) {

    if (typeof name !== 'object') {
        return this._add(name, method, options, realm);
    }

    // {} or [{}, {}]

    const items = [].concat(name);
    for (let i = 0; i < items.length; ++i) {
        const item = Schema.apply('methodObject', items[i]);
        this._add(item.name, item.method, item.options, realm);
    }
};


exports.methodNameRx = /^[_$a-zA-Z][$\w]*(?:\.[_$a-zA-Z][$\w]*)*$/;


internals.Methods.prototype._add = function (name, method, options, realm) {

    Hoek.assert(typeof method === 'function', 'method must be a function');
    Hoek.assert(typeof name === 'string', 'name must be a string');
    Hoek.assert(name.match(exports.methodNameRx), 'Invalid name:', name);
    Hoek.assert(!Hoek.reach(this.methods, name, { functions: false }), 'Server method function name already exists:', name);

    options = Schema.apply('method', options || {}, name);

    const settings = Hoek.cloneWithShallow(options, ['bind']);
    settings.generateKey = settings.generateKey || internals.generateKey;

    const bind = settings.bind || realm.settings.bind || null;
    const bound = !bind ? method : (...args) => method.apply(bind, args);

    // Not cached

    if (!settings.cache) {
        return this._assign(name, bound);
    }

    // Cached

    Hoek.assert(!settings.cache.generateFunc, 'Cannot set generateFunc with method caching:', name);
    Hoek.assert(settings.cache.generateTimeout !== undefined, 'Method caching requires a timeout value in generateTimeout:', name);

    settings.cache.generateFunc = (id, flags) => bound(...id.args, flags);

    const cache = this.server.cache(settings.cache, '#' + name);

    const func = function (...args) {

        const key = settings.generateKey.apply(bind, args);
        if (key === null ||                                 // Value can be ''
            typeof key !== 'string') {                      // When using custom generateKey

            return Promise.reject(Boom.badImplementation('Invalid method key when invoking: ' + name, { name, args }));
        }

        return cache.get({ id: key, args });
    };

    func.cache = {
        drop: function (...args) {

            const key = settings.generateKey.apply(null, args);
            if (key === null) {                             // Value can be ''
                return Promise.reject(Boom.badImplementation('Invalid method key'));
            }

            return cache.drop(key);
        },
        stats: cache.stats
    };

    this._assign(name, func, func);
};


internals.Methods.prototype._assign = function (name, method) {

    const path = name.split('.');
    let ref = this.methods;
    for (let i = 0; i < path.length; ++i) {
        if (!ref[path[i]]) {
            ref[path[i]] = (i + 1 === path.length ? method : {});
        }

        ref = ref[path[i]];
    }
};


internals.generateKey = function (...args) {

    let key = '';
    for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key = key + (i ? ':' : '') + encodeURIComponent(arg.toString());
    }

    return key;
};
