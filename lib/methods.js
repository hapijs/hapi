// Load modules

var Boom = require('boom');
var Catbox = require('catbox');
var Hoek = require('hoek');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Methods = function (server) {

    this.server = server;
    this.methods = {};
};


internals.Methods.prototype.add = function (name, fn, options, env) {

    if (typeof name !== 'object') {
        return this._add(name, fn, options, env);
    }

    // {} or [{}, {}]

    var items = [].concat(name);
    for (var i = 0, il = items.length; i < il; ++i) {
        var item = items[i];
        this._add(item.name, item.fn, item.options, env);
    }
};


exports.methodNameRx = /^[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)*$/;


internals.Methods.prototype._add = function (name, fn, options, env) {

    var self = this;

    Hoek.assert(typeof fn === 'function', 'fn must be a function');
    Hoek.assert(typeof name === 'string', 'name must be a string');
    Hoek.assert(name.match(exports.methodNameRx), 'Invalid name:', name);
    Hoek.assert(!Hoek.reach(this.methods, name, { functions: false }), 'Server method function name already exists');

    options = options || {};
    Schema.assert('method', options, name);

    var settings = Hoek.cloneWithShallow(options, ['bind']);
    settings.generateKey = settings.generateKey || internals.generateKey;
    var bind = settings.bind || env.bind || null;

    // Create method

    if (!settings.cache) {
        this._assign(name, function (/* arguments, methodNext */) {

            var args = arguments;
            var methodNext = args[args.length - 1];

            var timer = new Hoek.Timer();
            args[args.length - 1] = function (err, result) {

                methodNext(err, result, null, { msec: timer.elapsed(), error: err });
            };

            fn.apply(bind, args);
        });

        return;
    }

    settings.cache.generateFunc = function (id, next) {

        id.args[id.args.length - 1] = next;                 // function (err, result, ttl)
        fn.apply(bind, id.args);
    };

    var cache = this.server.cache(settings.cache, '#' + name);

    var method = function (/* arguments, methodNext */) {

        var args = arguments;
        var methodNext = args[args.length - 1];

        var key = settings.generateKey.apply(bind, args);
        if (key === null ||                                 // Value can be ''
            typeof key !== 'string') {                      // When using custom generateKey

            return Hoek.nextTick(methodNext)(Boom.badImplementation('Invalid method key when invoking: ' + name, { name: name, args: Array.prototype.slice.call(arguments, 0, arguments.length - 1) }));
        }

        cache.get({ id: key, args: args }, methodNext);
    };

    method.cache = {
        drop: function (/* arguments, callback */) {

            var dropCallback = arguments[arguments.length - 1];

            var key = settings.generateKey.apply(null, arguments);
            if (key === null) {                             // Value can be ''
                return Hoek.nextTick(dropCallback)(Boom.badImplementation('Invalid method key'));
            }

            return cache.drop(key, dropCallback);
        }
    };

    this._assign(name, method);
};


internals.Methods.prototype._assign = function (name, method) {

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

    var key = 'h';                                                   // 'h' for helper
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
