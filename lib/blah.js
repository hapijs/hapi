'use strict';

// Load modules

const Hoek = require('hoek');
const Response = require('./response');


// Declare internals

const internals = {};


exports = module.exports = internals.Reply = function () {

    this._decorations = null;

    this.abandon = Symbol('abandon');
    this.close = Symbol('close');
    this.continue = Symbol('continue');
};


internals.Reply.prototype.decorate = function (property, method) {

    Hoek.assert(!this._decorations || !this._decorations[property], 'Reply interface decoration already defined:', property);
    Hoek.assert(['close', 'entity', 'redirect', 'response', 'realm', 'request', 'state', 'unstate'].indexOf(property) === -1, 'Cannot override built-in reply interface decoration:', property);

    this._decorations = this._decorations || {};
    this._decorations[property] = method;
};


/*
    const handler = function (request, reply) {

        reply(result);                  -> result (continue)
        reply(result).takeover();       -> result (continue)
        reply.continue;                 -> null (continue)

        throw error;                    -> error (respond)
        reply(error);                   -> error (respond)

        <undefined>                     -> badImplementation (respond)
    };

    const pre = function (request, reply) {

        reply(result);                  -> result (continue)
        reply(result).takeover();       -> result (skip other pre and handler)
        reply.continue;                 -> null (continue)

        throw error;                    -> error (respond)      // failAction override
        reply(error);                   -> error (respond)

        <undefined>                     -> badImplementation (respond)
    };

    const ext = function (request, reply) {

        reply(result);                  -> result (continue) - only in onPostHandler and onPreResponse
        reply(result).takeover();       -> result (respond)
        reply.continue;                 -> (continue)

        throw error;                    -> error (respond)
        reply(error);                   -> error (respond)

        <undefined>                     -> badImplementation (respond)
    };

    const auth = function (request, reply) {

        reply(error, result, data);     -> error || result (respond) + data
        reply(..., data).takeover();    -> ... (respond) + data

        reply.continue(data);           -> (continue) + data
    };
*/

internals.Reply.prototype.interface = function (request, realm) {

    const reply = (response) => reply.response(response);

    reply.abandon = this.abandon; 
    reply.close = this.close;
    reply.continue = this.continue;

    reply.entity = internals.entity;
    reply.redirect = internals.redirect;
    reply.response = internals.response;

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
