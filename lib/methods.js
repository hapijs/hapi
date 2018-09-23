'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

const Config = require('./config');


// Declare internals

const internals = {
    methodNameRx: /^[_$a-zA-Z][$\w]*(?:\.[_$a-zA-Z][$\w]*)*$/
};


exports = module.exports = internals.Methods = class {

    constructor(core) {

        this.core = core;
        this.methods = {};
    }

    add(name, method, options, realm) {

        if (typeof name !== 'object') {
            return this._add(name, method, options, realm);
        }

        // {} or [{}, {}]

        const items = [].concat(name);
        for (let item of items) {
            item = Config.apply('methodObject', item);
            this._add(item.name, item.method, item.options || {}, realm);
        }
    }

    _add(name, method, options, realm) {

        Hoek.assert(typeof method === 'function', 'method must be a function');
        Hoek.assert(typeof name === 'string', 'name must be a string');
        Hoek.assert(name.match(internals.methodNameRx), 'Invalid name:', name);
        Hoek.assert(!Hoek.reach(this.methods, name, { functions: false }), 'Server method function name already exists:', name);

        options = Config.apply('method', options, name);

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
        const cache = this.core._cachePolicy(settings.cache, '#' + name);

        const func = function (...args) {

            const key = settings.generateKey.apply(bind, args);
            if (typeof key !== 'string') {
                return Promise.reject(Boom.badImplementation('Invalid method key when invoking: ' + name, { name, args }));
            }

            return cache.get({ id: key, args });
        };

        func.cache = {
            drop: function (...args) {

                const key = settings.generateKey.apply(bind, args);
                if (typeof key !== 'string') {
                    return Promise.reject(Boom.badImplementation('Invalid method key when invoking: ' + name, { name, args }));
                }

                return cache.drop(key);
            },
            stats: cache.stats
        };

        this._assign(name, func, func);
    }

    _assign(name, method) {

        const path = name.split('.');
        let ref = this.methods;
        for (let i = 0; i < path.length; ++i) {
            if (!ref[path[i]]) {
                ref[path[i]] = (i + 1 === path.length ? method : {});
            }

            ref = ref[path[i]];
        }
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
