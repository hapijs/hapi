// Load modules

var Domain = require('domain');
var Boom = require('boom');
var Async = require('async');
var Utils = require('./utils');


// Declare internals

var internals = {};

/*
    Extension functions use the following signature: function (request, next) { next(); }
*/

module.exports = internals.Ext = function () {

    this._events = {
        onRequest: null,                            // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreHandler: null,                         // After validation and body parsing, before route handler
        onPostHandler: null                         // After route handler returns, before sending response
    };
};


internals.Ext.prototype.add = function (event, func, options) {

    return this._add(event, func, options);
};


internals.Ext.prototype._add = function (event, func, options, plugin) {

    options = options || {};

    Utils.assert(['onRequest', 'onPreHandler', 'onPostHandler'].indexOf(event) !== -1, 'Unknown event type: ' + event);

    this._events[event] = this._events[event] || []

    var ext = {
        priority: this._events[event].length,
        before: Utils.clone(options.before) || [],
        after: Utils.clone(options.after) || [],
        group: plugin || '?',
        func: func
    };

    // Validate rules

    Utils.assert(ext.before.indexOf(ext.group) === -1, 'Plugin ext cannot come before itself (' + ext.plugin + ')');
    Utils.assert(ext.before.indexOf('?') === -1, 'Plugin ext cannot come before unassociated exts');
    Utils.assert(ext.after.indexOf(ext.group) === -1, 'Plugin ext cannot come after itself (' + ext.plugin + ')');
    Utils.assert(ext.after.indexOf('?') === -1, 'Plugin ext cannot come after unassociated exts');

    // Insert event

    this._events[event].push(ext);
    this.sort(event);
};


internals.Ext.prototype.sort = function (event) {

    var input = this._events[event];
    if (!input) {
        return;
    }

    // Sort

    var sorted = input;

    // Apply

    this._events[event] = sorted;
};


internals.Ext.prototype.invoke = function (request, event, callback) {

    var handlers = this._events[event];            // onRequest, onPreHandler, onPostHandler
    if (!handlers) {
        return callback();
    }

    Async.forEachSeries(handlers, function (ext, next) {

        internals.Ext.runProtected(request.log.bind(request), event, next, function (run, protectedNext) {

            run(function () {

                ext.func(request, protectedNext);
            });
        });
    },
    function (err) {

        return callback(err);
    });
};


internals.Ext.runProtected = function (log, tags, callback, setup) {

    var domain = Domain.createDomain();

    // Ensure only one callback returned

    var isFinished = false;
    var finish = function () {

        if (isFinished) {
            log(['duplicate', 'callback', 'error'].concat(tags || []));
            return;
        }

        isFinished = true;

        domain.exit();
        return callback.apply(null, arguments);
    };

    setup(function (run) {

        domain.on('error', function (err) {

            domain.dispose();
            log(['uncaught'].concat(tags || []), err);
            return finish(Boom.internal('Uncaught error', err));
        });

        // Execute functon

        domain.enter();
        run();
    },
    finish);
};
