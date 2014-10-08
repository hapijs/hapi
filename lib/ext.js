// Load modules

var Topo = require('topo');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Extension functions use the following signature: function (request, next) { next(); }

exports = module.exports = internals.Ext = function (events) {

    this._events = {};
    for (var i = 0, il = events.length; i < il; ++i) {
        this._events[events[i]] = null;
    }
};


internals.Ext.prototype.add = function (event, func, options, env) {

    options = options || {};

    Hoek.assert(this._events.hasOwnProperty(event), 'Unknown event type', event);

    var settings = {
        before: options.before,
        after: options.after,
        group: env.name
    };

    var nodes = [];
    ([].concat(func)).forEach(function (fn, i) {

        var node = {
            func: fn,
            env: env,
            bind: options.bind
        };

        nodes.push(node);
    });

    this._events[event] = this._events[event] || new Topo();
    this._events[event].add(nodes, settings);
};
