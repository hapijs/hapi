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
        onPreAuth: null,                            // After cookie parse and before authentication (skipped if state error)
        onPostAuth: null,                           // After authentication (and payload processing) and before validation (skipped if auth or payload error)
        onPreHandler: null,                         // After validation and body parsing, before route handler (skipped if auth or validation error)
        onPostHandler: null,                        // After route handler returns, before sending response (skipped if onPreHandler not called)
        onPreResponse: null                         // Before response is sent (always called)
    };
};


internals.Ext.prototype.add = function (event, func, options) {

    return this._add(event, func, options);
};


internals.Ext.prototype._add = function (event, func, options, plugin) {

    var self = this;

    options = options || {};

    Utils.assert(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'].indexOf(event) !== -1, 'Unknown event type', event);

    // Validate rules

    var before = [].concat(options.before || []);
    var after = [].concat(options.after || []);
    var group = plugin || '?';

    Utils.assert(before.indexOf(group) === -1, 'Plugin ext cannot come before itself:', group);
    Utils.assert(before.indexOf('?') === -1, 'Plugin ext cannot come before unassociated exts');
    Utils.assert(after.indexOf(group) === -1, 'Plugin ext cannot come after itself:', group);
    Utils.assert(after.indexOf('?') === -1, 'Plugin ext cannot come after unassociated exts');

    // Add functions

    this._events[event] = this._events[event] || [];

    ([].concat(func)).forEach(function (fn, i) {

        var ext = {
            priority: self._events[event].length,
            before: before,
            after: after,
            group: group,
            func: fn
        };

        self._events[event].push(ext);
    });

    // Insert event

    var error = this.sort(event);
    Utils.assert(!error, event, 'extension', (plugin ? 'add by ' + plugin : ''), 'created a dependencies error');
};


internals.Ext.prototype.invoke = function (request, event, callback) {

    var handlers = this._events[event];
    if (!handlers) {
        return Utils.nextTick(callback)();
    }

    var log = request.log.bind(request);

    Async.forEachSeries(handlers, function (ext, next) {

        internals.Ext.runProtected(log, event, next, function (enter, exit) {

            enter(function () {

                ext.func(request, exit);
            });
        });
    },
    function (err) {

        return callback(err);
    });
};


internals.Ext.runProtected = function (log, tags, next, setup) {        // setup: function (enter, exit)

    var domain = Domain.createDomain();

    // Ensure only one next returned

    var isFinished = false;
    var finish = function () {

        if (isFinished) {
            log(['hapi', 'duplicate', 'next', 'error'].concat(tags || []));
            return;
        }

        isFinished = true;

        domain.removeAllListeners();
        domain.exit();
        return next.apply(null, arguments);
    };

    setup(function (run) {

        domain.once('error', function (err) {

            log(['hapi', 'uncaught'].concat(tags || []), err);                  // 'uncaught' treated special in request.log
            return finish(Boom.internal('Uncaught error', err));
        });

        // Execute function

        domain.enter();
        run();
    },
    finish);
};


internals.Ext.prototype.sort = function (event) {

    var exts = this._events[event];
    if (!exts) {
        return;
    }

    // Construct graph

    var groups = {};
    var graph = {};
    var graphAfters = {};

    for (var i = 0, il = exts.length; i < il; ++i) {
        var ext = exts[i];
        var priority = ext.priority;
        var group = ext.group;

        // Determine Groups

        if (groups.hasOwnProperty(group)) {
            if (groups[group].indexOf(priority) === -1) {
                groups[group].push(priority);
            }
        }
        else {
            groups[group] = [priority];
        }

        // Build intermediary graph using 'before'

        var before = ext.before;
        graph[priority] = (graph[priority] || []).concat(before);

        // Build second intermediary graph with 'after'

        var after = ext.after;
        for (var j = 0, jl = after.length; j < jl; ++j) {
            graphAfters[after[j]] = (graphAfters[after[j]] || []).concat(priority);
        }
    }

    // Expand intermediary graph

    Object.keys(graph).forEach(function (node) {

        var expandedGroups = [];
        for (var groupIndex in graph[node]) {
            var group = graph[node][groupIndex];
            groups[group] = groups[group] || [];
            groups[group].forEach(function (d) {
                
                expandedGroups.push(d);
            });
        }
        graph[node] = expandedGroups;
    });

    // Merge intermediary graph using graphAfters into final graph

    var afterNodes = Object.keys(graphAfters);
    for (var n in afterNodes) {
        var group = afterNodes[n];

        for (var itemIndex in groups[group]) {
            var node = groups[group][itemIndex];
            graph[node] = (graph[node] || []).concat(graphAfters[group]);
        }
    }

    // Compile ancestors

    var ancestors = {};
    var graphNodes = Object.keys(graph);
    for (var i in graphNodes) {
        var node = graphNodes[i];
        var children = graph[node];

        for (var j = 0, jl = children.length; j < jl; ++j) {
            ancestors[children[j]] = (ancestors[children[j]] || []).concat(node);
        }
    }

    // Topo sort

    var visited = {};
    var sorted = [];

    for (var i = 0, il = exts.length; i < il; ++i) {
        var next = i;

        if (ancestors[i]) {
            next = null;
            for (var j = 0, jl = exts.length; j < jl; ++j) {
                if (visited[j] === true) {
                    continue;
                }

                if (!ancestors[j]) {
                    ancestors[j] = [];
                }

                var shouldSeeCount = ancestors[j].length;
                var seenCount = 0;
                for (var l = 0, ll = shouldSeeCount; l < ll; ++l) {
                    if (sorted.indexOf(ancestors[j][l]) >= 0) {
                        ++seenCount;
                    }
                }

                if (seenCount === shouldSeeCount) {
                    next = j;
                    break;
                }
            }
        }

        if (next !== null) {
            next = next.toString();         // Normalize to string
            visited[next] = true;
            sorted.push(next);
        }
    }

    if (sorted.length !== exts.length) {
        return new Error('Invalid dependencies');
    }

    var priorityIndex = {};
    exts.forEach(function (ext) {

        priorityIndex[ext.priority] = ext;
    });

    this._events[event] = sorted.map(function (value) {

        return priorityIndex[value];
    });
};
