// Load modules

var Boom = require('boom');
var Utils = require('./utils');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Methods = function (pack) {

    this.pack = pack;
    this.methods = {};
    this.helpers = {};
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
    Utils.assert(!Utils.reach(this.methods, name, { functions: false }) && !this.helpers[name], 'Helper or method function name already exists');

    var schemaError = Schema.method(options);
    Utils.assert(!schemaError, 'Invalid method options for', name, ':', schemaError);

    var settings = Utils.clone(options || {});
    settings.generateKey = settings.generateKey || internals.generateKey;

    var bind = (env && env.bind) || settings.bind || null;

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

            args[lastArgPos] = next;                // function (err, result, isUncacheable)
            fn.apply(bind, args);
        };

        var key = settings.generateKey.apply(bind, args);
        if (key === null) {                             // Value can be ''
            self.pack.log(['hapi', 'method', 'key', 'error'], { name: name, args: args });
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


// Backwards compatibility - remove in v3.0

internals.Methods.prototype.addHelper = function (/* name, method, options | {} | [{}, {}] */) {

    var helper = (typeof arguments[0] === 'string' ? { name: arguments[0], method: arguments[1], options: arguments[2] } : arguments[0]);
    var helpers = [].concat(helper);

    for (var i = 0, il = helpers.length; i < il; ++i) {
        var item = helpers[i];
        this._addHelper(item.name, item.method, item.options);
    }
};


internals.Methods.prototype._addHelper = function (name, method, options) {

    var self = this;

    Utils.assert(typeof method === 'function', 'method must be a function');
    Utils.assert(typeof name === 'string', 'name must be a string');
    Utils.assert(name.match(/^\w+$/), 'Invalid name:', name);
    Utils.assert(!this.methods[name] && !this.helpers[name], 'Helper or method function name already exists');

    var schemaError = Schema.helper(options);
    Utils.assert(!schemaError, 'Invalid helper options for', name, ':', schemaError);

    var settings = Utils.clone(options || {});
    settings.generateKey = settings.generateKey || internals.generateKey;

    // Create helper

    var cache = null;
    if (settings.cache) {
        cache = this.pack._provisionCache(settings.cache, 'method', name, settings.cache.segment);
    }

    var helper = function (/* arguments, helperNext */) {

        // Prepare arguments

        var args = arguments;
        var lastArgPos = args.length - 1;
        var helperNext = args[lastArgPos];

        // Wrap method for Cache.Stale interface 'function (next) { next(err, value); }'

        var generateFunc = function (next) {

            args[lastArgPos] = function (result) {

                if (result instanceof Error) {
                    return next(result);
                }

                return next(null, result);
            };

            method.apply(null, args);
        };

        if (!cache) {
            return generateFunc(function (err, result) {

                helperNext(err || result);
            });
        }

        var key = settings.generateKey.apply(null, args);
        if (key === null) {                             // Value can be ''
            self.pack.log(['hapi', 'helper', 'key', 'error'], { name: name, args: args });
        }

        cache.getOrGenerate(key, generateFunc, function (err, value, cached, report) {

            return helperNext(err || value);
        });
    };

    if (cache) {
        helper.cache = {
            drop: function (/* arguments, callback */) {

                var dropCallback = arguments[arguments.length - 1];

                var key = settings.generateKey.apply(null, arguments);
                if (key === null) {                             // Value can be ''
                    return Utils.nextTick(dropCallback)(Boom.badImplementation('Invalid helper key'));
                }

                return cache.drop(key, dropCallback);
            }
        };
    }

    this.helpers[name] = helper;
};
