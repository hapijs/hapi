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
    this._normalized = {};
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

    const apply = function () {

        return method.apply(bind, arguments);
    };

    const bound = bind ? apply : method;

    // Normalize methods

    let normalized = bound;
    if (settings.callback === false) {                                          // Defaults to true
        normalized = function (/* arg1, arg2, ..., argn, methodNext */) {

            const args = [];
            for (let i = 0; i < arguments.length - 1; ++i) {
                args.push(arguments[i]);
            }

            const methodNext = arguments[arguments.length - 1];

            let result = null;
            let error = null;

            try {
                result = method.apply(bind, args);
            }
            catch (err) {
                error = err;
            }

            if (result instanceof Error) {
                error = result;
                result = null;
            }

            if (error ||
                typeof result !== 'object' ||
                typeof result.then !== 'function') {

                return methodNext(error, result);
            }

            // Promise object

            const onFulfilled = (outcome) => methodNext(null, outcome);
            const onRejected = (err) => methodNext(err);
            result.then(onFulfilled, onRejected);
        };
    }

    // Not cached

    if (!settings.cache) {
        return this._assign(name, bound, normalized);
    }

    // Cached

    Hoek.assert(!settings.cache.generateFunc, 'Cannot set generateFunc with method caching:', name);
    Hoek.assert(settings.cache.generateTimeout !== undefined, 'Method caching requires a timeout value in generateTimeout:', name);

    settings.cache.generateFunc = (id, next) => {

        id.args.push(next);                     // function (err, result, ttl)
        normalized.apply(bind, id.args);
    };

    const cache = this.server.cache(settings.cache, '#' + name);

    const func = function (/* arguments, methodNext */) {

        const args = [];
        for (let i = 0; i < arguments.length - 1; ++i) {
            args.push(arguments[i]);
        }

        const methodNext = arguments[arguments.length - 1];

        const key = settings.generateKey.apply(bind, args);
        if (key === null ||                                 // Value can be ''
            typeof key !== 'string') {                      // When using custom generateKey

            return Hoek.nextTick(methodNext)(Boom.badImplementation('Invalid method key when invoking: ' + name, { name, args }));
        }

        cache.get({ id: key, args }, methodNext);
    };

    func.cache = {
        drop: function (/* arguments, callback */) {

            const args = [];
            for (let i = 0; i < arguments.length - 1; ++i) {
                args.push(arguments[i]);
            }

            const methodNext = arguments[arguments.length - 1];

            const key = settings.generateKey.apply(null, args);
            if (key === null) {                             // Value can be ''
                return Hoek.nextTick(methodNext)(Boom.badImplementation('Invalid method key'));
            }

            return cache.drop(key, methodNext);
        },
        stats: cache.stats
    };

    this._assign(name, func, func);
};


internals.Methods.prototype._assign = function (name, method, normalized) {

    const path = name.split('.');
    let ref = this.methods;
    for (let i = 0; i < path.length; ++i) {
        if (!ref[path[i]]) {
            ref[path[i]] = (i + 1 === path.length ? method : {});
        }

        ref = ref[path[i]];
    }

    this._normalized[name] = normalized;
};


internals.generateKey = function () {

    let key = '';
    for (let i = 0; i < arguments.length; ++i) {
        const arg = arguments[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key = key + (i ? ':' : '') + encodeURIComponent(arg.toString());
    }

    return key;
};
