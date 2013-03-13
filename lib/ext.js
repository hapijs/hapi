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
        before: [].concat(options.before || []),
        after: [].concat(options.after || []),
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


internals.Ext.prototype.sort = function (event) {

    var exts = this._events[event];
    if (!exts) {
        return;
    }

    // Sort

    var graph = internals.getGraph(exts);
    var ancestors = internals.getAncestors(graph);
    var sorted = internals.topoSort(ancestors, exts.length);

    var priorityIndex = {};
    exts.forEach(function (ext) {

        priorityIndex[ext.priority] = ext;
    });

    this._events[event] = sorted.map(function (value) {

        return priorityIndex[value];
    });
};


internals.getGraph = function (exts) {

    var groups = {};
    var graph = {};
    var graphAfters = {};

    for (var i = 0, il = exts.length; i < il; ++i) {
        var ext = exts[i];
        var priority = ext.priority;
        var group = ext.group;

        // Determine Groups

        if (groups.hasOwnProperty(group)) {
            if (groups[group].indexOf(priority) == -1) {
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
            graph[node] = (graph[node] || []).concat(graphAfters[group])
        }
    }

    return graph;
};


internals.getAncestors = function (graph) {

    var ancestors = {};
    var graphNodes = Object.keys(graph);
    for (var i in graphNodes) {
        var node = graphNodes[i];
        var children = graph[node];

        for (var j = 0, jl = children.length; j < jl; ++j) {
            ancestors[children[j]] = (ancestors[children[j]] || []).concat(node);
        }
    }

    return ancestors;
};


internals.topoSort = function (ancestorsGraph, length) {

    var visited = {};
    var sorted = [];
    length = length || ancestorsGraph.length;

    var ancNodes = Object.keys(ancestorsGraph);

    for (var i = 0, il = length; i < il; ++i) {
        var next = i;

        if (ancestorsGraph[i]) {
            next = null;
            for (var j = 0, jl = length; j < jl; ++j) {
                if (visited[j] == true) {
                    continue;
                }

                if (!ancestorsGraph[j]) {
                    ancestorsGraph[j] = [];
                }

                var shouldSeeCount = ancestorsGraph[j].length;
                var seenCount = 0;
                for (var l = 0, ll = shouldSeeCount; l < ll; ++l) {
                    if (sorted.indexOf(ancestorsGraph[j][l]) >= 0) {
                        ++seenCount;
                    }
                }

                if (seenCount == shouldSeeCount) {
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

    Utils.assert(sorted.length === length, 'Invalid ext dependencies detected');
    return sorted;
};
