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

    var sorted = internals.depsort(input);

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


internals.getGraph = function (plugins) {

    var groups = {};
    var graph = {};
    var graphAfters = {};
    var result = [];
    
    for(var i = 0, il = plugins.length; i < il; ++i) {
        var plugin = plugins[i];
        var index = plugin.priority;
        var group = plugin.group;
        
        // Determine Groups
        if (groups.hasOwnProperty(group)) {
            if (groups[group].indexOf(index) == -1) {
                groups[group].push(index);
            }
        }
        else {
            groups[group] = [index];
        }
        
        var hasBefore = plugin.hasOwnProperty('before');
        var hasAfter = plugin.hasOwnProperty('after');
        
        // Build intermediary graph using 'before'
        if (hasBefore) {
            var before = plugin.before;
            if (!(before instanceof Array)) {
                before = [before];
            }
            
            graph[index] = (graph[index] || []).concat(before);
        }
        
        // Build second intermediary graph with "after"
        if (hasAfter) {
            var after = plugin.after;
            if (!(after instanceof Array)) {
                after = [after];
            }
            
            for(var j = 0, jl = after.length; j < jl; ++j) {
                graphAfters[after[j]] = (graphAfters[after[j]] || []).concat(index);
            }
        }
    }
    
    // Expand intermediary graph
    var nodes = Object.keys(graph);
    for(var m in nodes) {
        var node = nodes[m];
        var expandedGroups = [];
        
        for(var groupIndex in graph[node]) {
            var group = graph[node][groupIndex];
            groups[group].forEach(function(d){
                expandedGroups.push(d);
            })
        }
        graph[node] = expandedGroups;
    }
    
    // Merge intermediary graph using graphAfters into final graph
    var afterNodes = Object.keys(graphAfters);
    for(var n in afterNodes) {
        var group = afterNodes[n];
        
        for(var itemIndex in groups[group]) {
            var node = groups[group][itemIndex];
            graph[node] = (graph[node] || []).concat(graphAfters[group])
        }
    }
    
    return graph;
};


internals.getAncestors = function (graph) {

    var ancestors = {};
    var graphNodes = Object.keys(graph);
    for(var i in graphNodes) {
        var node = graphNodes[i];
        var children = graph[node];
        
        for(var j = 0, jl = children.length; j < jl; ++j) {
            ancestors[children[j]] = (ancestors[children[j]] || []).concat(node);
        }
    }
    
    return ancestors;
};

internals.toposort = function (ancestorsGraph, length) {

    var visited = {};
    var sorted = [];
    length = length || ancestorsGraph.length;
    
    var ancNodes = Object.keys(ancestorsGraph);
    
    for(var i = 0, il = length; i < il; ++i) {
        var next = i;
        
        if (ancestorsGraph[i]) {
            next = null;
            for(var j = 0, jl = length; j < jl; ++j) {
                if (visited[j] == true) {
                    continue;
                }
                
                if (!ancestorsGraph[j]) {
                    ancestorsGraph[j] = [];
                }
                
                var shouldSeeCount = ancestorsGraph[j].length;
                var seenCount = 0;
                for(var l = 0, ll = shouldSeeCount; l < ll; ++l) {
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
            next = next.toString(); // normalize to string
            visited[next] = true;
            sorted.push(next);
        }
    }
    
    if (sorted.length != length) {
        throw "Invalid plugin input supplied"; // Occurs if before/after set to item's group (but not limited to this case)
    }
    
    return sorted;
};


internals.depsort = function (plugins) {

    var graph = internals.getGraph(plugins);
    var ancestors = internals.getAncestors(graph);
    return internals.toposort(ancestors, plugins.length).map(function (value, index) {

        return plugins[value];
    });
};