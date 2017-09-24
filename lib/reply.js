'use strict';

// Load modules

const Boom = require('boom');
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
    Hoek.assert(['abandon', 'authenticated', 'close', 'continue', 'entity', 'redirect', 'response', 'realm', 'request', 'state', 'unauthenticated', 'unstate'].indexOf(property) === -1, 'Cannot override built-in reply interface decoration:', property);

    this._decorations = this._decorations || {};
    this._decorations[property] = method;
};


internals.Reply.prototype.execute = async function (method, request, options) {

    const reply = this._interface(request, options);
    const bind = options.bind || null;

    let response;
    try {
        response = await (options.args ? method.call(bind, request, reply, ...options.args) : method.call(bind, request, reply));
    }
    catch (err) {
        response = err instanceof Error ? Boom.boomify(err) : Boom.badImplementation('Unhandled rejected promise', err);
    }

    // Process response

    if (response === undefined) {
        response = Boom.badImplementation('Method did not return a value, a promise, or throw an error');
    }

    if (options.continue &&
        response === this.continue) {

        if (options.continue === 'undefined') {
            return;
        }

        if (options.continue === 'null') {
            response = null;
        }
    }

    if (options.auth &&
        response instanceof internals.Auth) {

        return response;
    }

    if (typeof response !== 'symbol') {
        response = Response.wrap(response, request);
        if (!response.isBoom) {
            response = await response._prepare();
        }
    }

    return response;
};


/*
    const handler = function (request, reply) {

        reply(result);                      -> result (continue)
        reply(result).takeover();           -> result (continue)
        reply.continue;                     -> null (continue)

        throw error;                        -> error (respond)
        reply(error);                       -> error (respond)

        <undefined>                         -> badImplementation (respond)
    };

    const pre = function (request, reply) {

        reply(result);                      -> result (continue)
        reply(result).takeover();           -> result (skip other pre and handler)
        reply.continue;                     -> null (continue)

        throw error;                        -> error (respond)      // failAction override
        reply(error);                       -> error (respond)

        <undefined>                         -> badImplementation (respond)
    };

    const ext = function (request, reply) {

        reply(result);                      -> result (continue) - only in onPostHandler and onPreResponse, otherwise: badImplementation (respond)
        reply(result).takeover();           -> result (respond)
        reply.continue;                     -> (continue)

        throw error;                        -> error (respond)
        reply(error);                       -> error (respond)

        <undefined>                         -> badImplementation (respond)
    };

    const auth = function (request, reply) {

        // Unauthenticated

        reply(result);                      -> badImplementation (respond)
        reply(result).takeover();           -> result (respond)
        reply.continue;                     -> badImplementation (respond)

        throw error;                        -> error (respond)
        reply(error);                       -> error (respond)

        <undefined>                         -> badImplementation (respond)

        reply.unauthenticated(error, data)  -> error (respond) + data

        // Authenticated

        reply.authenticated(data )          -> (continue) + data

        // Note: scheme.payload and scheme.response use the same interface as pre-handler extension methods
    };
*/

internals.Reply.prototype._interface = function (request, options) {

    const reply = (response) => reply.response(response);

    reply.abandon = this.abandon;
    reply.close = this.close;
    reply.continue = this.continue;

    reply.entity = internals.entity;
    reply.redirect = internals.redirect;
    reply.response = internals.response;

    reply.realm = options.realm;
    reply.request = request;

    reply.state = internals.state;
    reply.unstate = internals.unstate;

    if (options.auth) {
        reply.authenticated = internals.authenticated;
        reply.unauthenticated = internals.unauthenticated;
    }

    if (this._decorations) {
        const methods = Object.keys(this._decorations);
        for (let i = 0; i < methods.length; ++i) {
            const method = methods[i];
            reply[method] = this._decorations[method];
        }
    }

    return reply;
};


internals.response = function (result) {

    return Response.wrap(result, this.request);
};


internals.redirect = function (location) {

    return this.response('').redirect(location);
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


internals.state = function (name, value, options) {

    this.request._setState(name, value, options);
};


internals.unstate = function (name, options) {

    this.request._clearState(name, options);
};


internals.authenticated = function (data) {

    Hoek.assert(data && data.credentials, 'Authentication data missing credentials information');

    return new internals.Auth(null, data);
};


internals.unauthenticated = function (error, data) {

    Hoek.assert(!data || data.credentials, 'Authentication data missing credentials information');

    return new internals.Auth(error, data);
};


internals.Auth = function (error, data) {

    this.isAuth = true;
    this.error = error;
    this.data = data;
};
