'use strict';

// Load modules

const Hoek = require('hoek');
const Topo = require('topo');


// Declare internals

const internals = {};


exports = module.exports = internals.Ext = function (type, server) {

    this._topo = new Topo();
    this._server = server;
    this._routes = [];

    this.type = type;
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


internals.Ext.combine = function (route, type) {

    const ext = new internals.Ext(type, route.server);

    const events = route.settings.ext[type];
    if (events) {
        for (let i = 0; i < events.length; ++i) {
            const event = Hoek.shallow(events[i]);
            Hoek.assert(!event.options.sandbox, 'Cannot specify sandbox option for route extension');
            event.plugin = route.plugin;
            ext.add(event);
        }
    }

    const connection = route.connection._extensions[type];
    const realm = route.plugin.realm._extensions[type];

    ext.merge([connection, realm]);

    connection.subscribe(route);
    realm.subscribe(route);

    return ext;
};
