// Load modules

var Boom = require('boom');
var Utils = require('./utils');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Methods = function (pack) {

    this.pack = pack;
    this.methods = {};
};


internals.Methods.prototype.add = function (/* name, fn, options, env | {}, env | [{}, {}], env */) {

    if (typeof arguments[0] === 'string') {
        return internals.Methods.prototype._add.apply(this, arguments);
    }

    var items = [].concat(arguments[0]);
    var env = arguments[1];
    for (var i = 0, il = items.length; i < il; ++i) {
        var item = items[i];
        this._add(item.name, item.fn, item.options, env);
    }
};


exports.methodNameRx = /^[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)*$/;


internals.Methods.prototype._add = function (name, fn, options, env) {

    var self = this;

    Utils.assert(typeof fn === 'function', 'fn must be a function');
    Utils.assert(typeof name === 'string', 'name must be a string');
    Utils.assert(name.match(exports.methodNameRx), 'Invalid name:', name);
    Utils.assert(!Utils.reach(this.methods, name, { functions: false }), 'Server method function name already exists');

    options = options || {};
    Schema.assert('method', options, name);

    var settings = Utils.clone(options);
    settings.generateKey = settings.generateKey || internals.generateKey;

    var bind = settings.bind || (env && env.bind) || null;

    // Create method

    var cache = null;
    if (settings.cache) {
        cache = this.pack._provisionCache(settings.cache, 'method', name, settings.cache.segment);
    }

    var method = function (/* arguments, methodNext */) {

        if (!cache) {
            return fn.apply(bind, arguments);
        }

        var args = arguments;
        var lastArgPos = args.length - 1;
        var methodNext = args[lastArgPos];

        var generateFunc = function (next) {

            args[lastArgPos] = next;                // function (err, result, ttl)
            fn.apply(bind, args);
        };

        var key = settings.generateKey.apply(bind, args);
        if (key === null || typeof key !== 'string') {                             // Value can be ''
            self.pack.log(['hapi', 'method', 'key', 'error'], { name: name, args: args, key: key });
            key = null;
        }

        cache.getOrGenerate(key, generateFunc, methodNext);
    };

    if (cache) {
        method.cache = {
            drop: function (/* arguments, callback */) {

                var dropCallback = arguments[arguments.length - 1];

                var key = settings.generateKey.apply(null, arguments);
                if (key === null) {                             // Value can be ''
                    return Utils.nextTick(dropCallback)(Boom.badImplementation('Invalid method key'));
                }

                return cache.drop(key, dropCallback);
            }
        };
    }

    // create method path

    var path = name.split('.');
    var ref = this.methods;
    for (var i = 0, il = path.length; i < il; ++i) {
        if (!ref[path[i]]) {
            ref[path[i]] = (i + 1 === il ? method : {});
        }

        ref = ref[path[i]];
    }
};


internals.generateKey = function () {

    var key = 'h';
    for (var i = 0, il = arguments.length - 1; i < il; ++i) {        // 'arguments.length - 1' to skip 'next'
        var arg = arguments[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key += ':' + encodeURIComponent(arg.toString());
    }

    return key;
};
