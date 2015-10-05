// Load modules

var Topo = require('topo');


// Declare internals

var internals = {};


exports = module.exports = internals.Ext = function (server) {

    this._topo = new Topo();
    this._server = server;
    this._routes = [];

    this.nodes = null;
};


internals.Ext.prototype.add = function (event) {

    var methods = [].concat(event.method);
    var options = event.options;

    for (var i = 0, il = methods.length; i < il; ++i) {
        var settings = {
            before: options.before,
            after: options.after,
            group: event.plugin.realm.plugin,
            sort: this._server._extensionsSeq++
        };

        var node = {
            func: methods[i],                 // Connection: function (request, next), Server: function (server, next)
            bind: options.bind,
            plugin: event.plugin
        };

        this._topo.add(node, settings);
    }

    this.nodes = this._topo.nodes;

    // Notify routes

    for (i = 0, il = this._routes.length; i < il; ++i) {
        this._routes[i].rebuild(event);
    }
};


internals.Ext.prototype.merge = function (others) {

    var merge = [];
    for (var i = 0, il = others.length; i < il; ++i) {
        merge.push(others[i]._topo);
    }

    this._topo.merge(merge);
    this.nodes = (this._topo.nodes.length ? this._topo.nodes : null);
};


internals.Ext.prototype.subscribe = function (route) {

    this._routes.push(route);
};
