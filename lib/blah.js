'use strict';

// Load modules

const Hoek = require('hoek');
const Response = require('./response');


// Declare internals

const internals = {};


exports = module.exports = internals.Reply = function () {

    this._decorations = null;
};


internals.Reply.prototype.decorate = function (property, method) {

    Hoek.assert(!this._decorations || !this._decorations[property], 'Reply interface decoration already defined:', property);
    Hoek.assert(['request', 'response', 'close', 'state', 'unstate', 'redirect', 'continue'].indexOf(property) === -1, 'Cannot override built-in reply interface decoration:', property);

    this._decorations = this._decorations || {};
    this._decorations[property] = method;
};


/*
    const handler = function (request, reply) {

        reply(error, result, ignore);   -> error || result (continue)
        reply(...).takeover();          -> ... (continue)

        reply.continue(ignore);         -> null (continue)
    };

    const ext = function (request, reply) {

        reply(error, result, ignore);   -> error || result (respond)
        reply(...).takeover();          -> ... (respond)

        reply.continue(ignore);         -> (continue)
    };

    const pre = function (request, reply) {

        reply(error);                   -> error (respond)  // failAction override
        reply(null, result, ignore);    -> result (continue)
        reply(...).takeover();          -> ... (respond)

        reply.continue(ignore);         -> null (continue)
    };

    const auth = function (request, reply) {

        reply(error, result, data);     -> error || result (respond) + data
        reply(..., data).takeover();    -> ... (respond) + data

        reply.continue(data);           -> (continue) + data
    };
*/

internals.Reply.prototype.interface = function (request, realm, options) {

    const reply = (err, response) => {

        return reply.response(err !== null && err !== undefined ? err : response);
    };

    reply.close = internals.close;
    reply.redirect = internals.redirect;
    reply.response = internals.response;
    reply.entity = internals.entity;

    reply._settings = options;
    reply._replied = false;

    reply.realm = realm;
    reply.request = request;

    reply.state = internals.state;
    reply.unstate = internals.unstate;

    if (this._decorations) {
        const methods = Object.keys(this._decorations);
        for (let i = 0; i < methods.length; ++i) {
            const method = methods[i];
            reply[method] = this._decorations[method];
        }
    }

    return reply;
};


internals.Reply.prototype.signal = function (response) {

    if (response instanceof internals.Close) {
        return 'close';
    }

    return null;
};


internals.close = function (options) {

    return new internals.Close(options);
};


internals.state = function (name, value, options) {

    this.request._setState(name, value, options);
};


internals.unstate = function (name, options) {

    this.request._clearState(name, options);
};


internals.redirect = function (location) {

    return this.response('').redirect(location);
};


internals.response = function (result) {

    Hoek.assert(!this._replied, 'reply interface called twice');
    this._replied = true;

    return Response.wrap(result, this.request);
};


internals.entity = function (options) {

    Hoek.assert(options, 'Entity method missing required options');
    Hoek.assert(options.etag || options.modified, 'Entity methods missing require options key');

    this.request._entity = options;

    const entity = Response.entity(options.etag, options);
    if (Response.unmodified(this.request, entity)) {
        return this.response().code(304).takeover();
    }

    return null;
};


internals.Close = function (options = {}) {

    this.end = options.end !== false;           // Defaults to true
};
