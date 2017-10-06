'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

const Response = require('./response');


// Declare internals

const internals = {};


exports = module.exports = internals.Responder = class {

    constructor() {

        this._decorations = null;

        this.abandon = Symbol('abandon');
        this.close = Symbol('close');
        this.continue = Symbol('continue');
    }

    decorate(property, method) {

        Hoek.assert(!this._decorations || !this._decorations[property], 'Reply interface decoration already defined:', property);
        Hoek.assert(['abandon', 'authenticated', 'close', 'continue', 'entity', 'redirect', 'wrap', 'realm', 'request', 'state', 'unauthenticated', 'unstate'].indexOf(property) === -1, 'Cannot override built-in responder interface decoration:', property);

        this._decorations = this._decorations || {};
        this._decorations[property] = method;
    }

    async execute(method, request, options) {

        const responder = new internals.Responder(request, this, options);
        const bind = options.bind || null;

        let response;
        try {
            response = await (options.args ? method.call(bind, request, responder, ...options.args) : method.call(bind, request, responder));
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
    }
};


/*
    const handler = function (request, responder) {

        result / responder.wrap(result)             -> result               // Not allowed in auth or in ext before handler
        responder.wrap(result).takeover()           -> result (respond)
        responder.continue                          -> null                 // Defaults to null only in handler and pre, not allowed in auth

        throw error / responder.wrap(error)         -> error (respond)      // failAction override in pre
        <undefined>                                 -> badImplementation (respond)

        // Auth only (scheme.payload and scheme.response use the same interface as pre-handler extension methods)

        responder.unauthenticated(error, data)      -> error (respond) + data
        responder.authenticated(data )              -> (continue) + data
    };
*/

internals.Responder = class {

    constructor(request, manager, options) {

        this.realm = options.realm;
        this.request = request;

        this.abandon = manager.abandon;
        this.close = manager.close;
        this.continue = manager.continue;
        this.context = options.bind;

        if (options.auth) {
            this.authenticated = internals.authenticated;
            this.unauthenticated = internals.unauthenticated;
        }

        if (manager._decorations) {
            const methods = Object.keys(manager._decorations);
            for (let i = 0; i < methods.length; ++i) {
                const method = methods[i];
                this[method] = manager._decorations[method];
            }
        }
    }

    wrap(result) {

        Hoek.assert(!result || typeof result !== 'object' || typeof result.then !== 'function', 'Cannot wrap a promise');
        return Response.wrap(result, this.request);
    }

    redirect(location) {

        return this.wrap('').redirect(location);
    }

    entity(options) {

        Hoek.assert(options, 'Entity method missing required options');
        Hoek.assert(options.etag || options.modified, 'Entity methods missing require options key');

        this.request._entity = options;

        const entity = Response.entity(options.etag, options);
        if (Response.unmodified(this.request, entity)) {
            return this.wrap().code(304).takeover();
        }

        return null;
    }

    state(name, value, options) {

        this.request._setState(name, value, options);
    }

    unstate(name, options) {

        this.request._clearState(name, options);
    }
};


internals.authenticated = function (data) {

    Hoek.assert(data && data.credentials, 'Authentication data missing credentials information');

    return new internals.Auth(null, data);
};


internals.unauthenticated = function (error, data) {

    Hoek.assert(!data || data.credentials, 'Authentication data missing credentials information');

    return new internals.Auth(error, data);
};


internals.Auth = class {

    constructor(error, data) {

        this.isAuth = true;
        this.error = error;
        this.data = data;
    }
};
