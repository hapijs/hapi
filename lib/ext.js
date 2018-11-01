'use strict';

// Load modules

const Hoek = require('hoek');
const Topo = require('topo');


// Declare internals

const internals = {};


exports = module.exports = internals.Ext = class {

    constructor(type, core) {

        this._topo = new Topo();
        this._core = core;
        this._routes = [];

        this.type = type;
        this.nodes = null;
    }

    add(event) {

        const methods = [].concat(event.method);
        const options = event.options;

        for (const method of methods) {
            const settings = {
                before: options.before,
                after: options.after,
                group: event.realm.plugin,
                sort: this._core.extensionsSeq++
            };

            const node = {
                func: method,                       // Request: function (request, h), Server: function (server)
                bind: options.bind,
                server: event.server,               // Server event
                realm: event.realm
            };

            this._topo.add(node, settings);
        }

        this.nodes = this._topo.nodes;

        // Notify routes

        for (const route of this._routes) {
            route.rebuild(event);
        }
    }

    merge(others) {

        const merge = [];
        for (const other of others) {
            merge.push(other._topo);
        }

        this._topo.merge(merge);
        this.nodes = (this._topo.nodes.length ? this._topo.nodes : null);
    }

    subscribe(route) {

        this._routes.push(route);
    }

    static combine(route, type) {

        const ext = new internals.Ext(type, route._core);

        const events = route.settings.ext[type];
        if (events) {
            for (let event of events) {
                event = Object.assign({}, event);       // Shallow cloned
                Hoek.assert(!event.options.sandbox, 'Cannot specify sandbox option for route extension');
                event.realm = route.realm;
                ext.add(event);
            }
        }

        const server = route._core.extensions.route[type];
        const realm = route.realm._extensions[type];

        ext.merge([server, realm]);

        server.subscribe(route);
        realm.subscribe(route);

        return ext;
    }
};
