'use strict';

// Load modules

const Topo = require('topo');


// Declare internals

const internals = {};


exports = module.exports = internals.Ext = function (server) {

    this._topo = new Topo();
    this._server = server;
    this._routes = [];

    this.nodes = null;
};


internals.Ext.prototype.add = function (event) {

    const methods = [].concat(event.method);
    const options = event.options;

    for (let i = 0; i < methods.length; ++i) {
        const settings = {
            before: options.before,
            after: options.after,
            group: event.plugin.realm.plugin,
            sort: this._server._extensionsSeq++
        };

        const node = {
            func: methods[i],                 // Connection: function (request, next), Server: function (server, next)
            bind: options.bind,
            plugin: event.plugin
        };

        this._topo.add(node, settings);
    }

    this.nodes = this._topo.nodes;

    // Notify routes

    for (let i = 0; i < this._routes.length; ++i) {
        this._routes[i].rebuild(event);
    }
};


internals.Ext.prototype.merge = function (others) {

    const merge = [];
    for (let i = 0; i < others.length; ++i) {
        merge.push(others[i]._topo);
    }

    this._topo.merge(merge);
    this.nodes = (this._topo.nodes.length ? this._topo.nodes : null);
};


internals.Ext.prototype.subscribe = function (route) {

    this._routes.push(route);
};
