'use strict';

const Hoek = require('@hapi/hoek');
const Topo = require('@hapi/topo');


const internals = {};


exports = module.exports = internals.Ext = class {

    type = null;
    nodes = null;

    #core = null;
    #routes = [];
    #topo = new Topo.Sorter();

    constructor(type, core) {

        this.#core = core;
        this.type = type;
    }

    add(event) {

        const methods = [].concat(event.method);
        for (const method of methods) {
            const settings = {
                before: event.options.before,
                after: event.options.after,
                group: event.realm.plugin,
                sort: this.#core.extensionsSeq++
            };

            const node = {
                func: method,                       // Request: function (request, h), Server: function (server)
                bind: event.options.bind,
                server: event.server,               // Server event
                realm: event.realm,
                timeout: event.options.timeout
            };

            this.#topo.add(node, settings);
        }

        this.nodes = this.#topo.nodes;

        // Notify routes

        for (const route of this.#routes) {
            route.rebuild(event);
        }
    }

    merge(others) {

        const merge = [];
        for (const other of others) {
            merge.push(other.#topo);
        }

        this.#topo.merge(merge);
        this.nodes = this.#topo.nodes.length ? this.#topo.nodes : null;
    }

    subscribe(route) {

        this.#routes.push(route);
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
