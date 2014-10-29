// Load modules

var Topo = require('topo');
var Hoek = require('hoek');


// Declare internals

var internals = {};

/*
    onRequest:      New request, before handing over to the router (allows changes to the request method, url, etc.)
    onPreAuth:      After cookie parse and before authentication (skipped if state error)
    onPostAuth:     After authentication (and payload processing) and before validation (skipped if auth or payload error)
    onPreHandler:   After validation and body parsing, before route handler (skipped if auth or validation error)
    onPostHandler:  After route handler returns, before sending response (skipped if onPreHandler not called)
    onPreResponse:  Before response is sent (always called)

    Extension functions use the following signature: function (request, next) { next(); }
*/


exports = module.exports = internals.Ext = function () {

    this._events = {
        onRequest: null,
        onPreAuth: null,
        onPostAuth: null,
        onPreHandler: null,
        onPostHandler: null,
        onPreResponse: null
    };
};


internals.Ext.prototype.add = function (event, func, options, env) {

    options = options || {};

    Hoek.assert(this._events[event] !== undefined, 'Unknown event type', event);

    var settings = {
        before: options.before,
        after: options.after,
        group: env.plugin
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
