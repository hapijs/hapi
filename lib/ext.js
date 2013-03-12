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

    this.onRequest = null;                              // New request, before handing over to the router (allows changes to the request method, url, etc.)
    this.onPreHandler = null;                           // After validation and body parsing, before route handler
    this.onPostHandler = null;                          // After route handler returns, before sending response
};


internals.Ext.prototype.add = function (event, func, options) {

    return this._add(event, func, options);
};


internals.Ext.prototype._add = function (event, func, options, plugin) {

    Utils.assert(['onRequest', 'onPreHandler', 'onPostHandler'].indexOf(event) !== -1, 'Unknown event type: ' + event);
    this[event] = this[event] || []

    var ext = {
        priority: this[event].length,
        settings: Utils.clone(options) || {},
        plugin: plugin || null,
        func: func
    };

    this[event].push(ext);
    this._sort(event);
};


internals.Ext.prototype.invoke = function (request, event, callback) {

    var handlers = this[event];            // onRequest, onPreHandler, onPostHandler
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


internals.Ext.prototype._sort = function (event) {

    var exts = this[event];
    if (!exts) {
        return;
    }

    // Sort extensions

    exts.forEach(function (ext) {

        var before = ext.settings.before || [];
        var after = ext.settings.after || [];

        if (ext.plugin) {
            Utils.assert(before.indexOf(ext.plugin) === -1, 'Plugin ext cannot come before itself (' + ext.plugin + ')');
            Utils.assert(after.indexOf(ext.plugin) === -1, 'Plugin ext cannot come after itself (' + ext.plugin + ')');
        }
    });
};
