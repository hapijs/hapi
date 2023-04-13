'use strict';

const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');


const internals = {};


exports.reserved = [
    'abandon',
    'authenticated',
    'close',
    'context',
    'continue',
    'entity',
    'redirect',
    'realm',
    'request',
    'response',
    'state',
    'unauthenticated',
    'unstate'
];


exports.symbols = {
    abandon: Symbol('abandon'),
    close: Symbol('close'),
    continue: Symbol('continue')
};


exports.Manager = class {

    constructor() {

        this._toolkit = internals.toolkit();
    }

    async execute(method, request, options) {

        const h = new this._toolkit(request, options);
        const bind = options.bind ?? null;

        try {
            let operation;

            if (bind) {
                operation = method.call(bind, request, h);
            }
            else if (options.args) {
                operation = method(request, h, ...options.args);
            }
            else {
                operation = method(request, h);
            }

            var response = await exports.timed(operation, options);
        }
        catch (err) {
            if (Bounce.isSystem(err)) {
                response = Boom.badImplementation(err);
            }
            else if (!Bounce.isError(err)) {
                response = Boom.badImplementation('Cannot throw non-error object', err);
            }
            else {
                response = Boom.boomify(err);
            }
        }

        // Process response

        if (options.ignoreResponse) {
            return response;
        }

        if (response === undefined) {
            response = Boom.badImplementation(`${method.name} method did not return a value, a promise, or throw an error`);
        }

        if (options.continue &&
            response === exports.symbols.continue) {

            if (options.continue === 'undefined') {
                return;
            }

            // 'null'

            response = null;
        }

        if (options.auth &&
            response instanceof internals.Auth) {

            return response;
        }

        if (typeof response !== 'symbol') {
            response = request._core.Response.wrap(response, request);
            if (!response.isBoom && response._state === 'init') {
                await response._prepare();
            }
        }

        return response;
    }

    decorate(name, method) {

        this._toolkit.prototype[name] = method;
    }

    async failAction(request, failAction, err, options) {

        const retain = options.retain ? err : undefined;
        if (failAction === 'ignore') {
            return retain;
        }

        if (failAction === 'log') {
            request._log(options.tags, err);
            return retain;
        }

        if (failAction === 'error') {
            throw err;
        }

        return await this.execute(failAction, request, { realm: request.route.realm, args: [options.details ?? err] });
    }
};


exports.timed = async function (method, options) {

    if (!options.timeout) {
        return method;
    }

    const timer = new Promise((resolve, reject) => {

        const handler = () => {

            reject(Boom.internal(`${options.name} timed out`));
        };

        setTimeout(handler, options.timeout);
    });

    return await Promise.race([timer, method]);
};


/*
    const handler = function (request, h) {

        result / h.response(result)         -> result                           // Not allowed before handler
        h.response(result).takeover()       -> result (respond)
        h.continue                          -> null                             // Defaults to null only in handler and pre, not allowed in auth

        throw error / h.response(error)     -> error (respond)                  // failAction override in pre
        <undefined>                         -> badImplementation (respond)

        // Auth only (scheme.payload and scheme.response use the same interface as pre-handler extension methods)

        h.unauthenticated(error, data)      -> error (respond) + data
        h.authenticated(data )              -> (continue) + data
    };
*/

internals.toolkit = function () {

    const Toolkit = class {

        constructor(request, options) {

            this.context = options.bind;
            this.realm = options.realm;
            this.request = request;

            this._auth = options.auth;
        }

        response(result) {

            Hoek.assert(!result || typeof result !== 'object' || typeof result.then !== 'function', 'Cannot wrap a promise');
            Hoek.assert(result instanceof Error === false, 'Cannot wrap an error');
            Hoek.assert(typeof result !== 'symbol', 'Cannot wrap a symbol');

            return this.request._core.Response.wrap(result, this.request);
        }

        redirect(location) {

            return this.response('').redirect(location);
        }

        entity(options) {

            Hoek.assert(options, 'Entity method missing required options');
            Hoek.assert(options.etag || options.modified, 'Entity methods missing required options key');

            this.request._entity = options;

            const entity = this.request._core.Response.entity(options.etag, options);
            if (this.request._core.Response.unmodified(this.request, entity)) {
                return this.response().code(304).takeover();
            }
        }

        state(name, value, options) {

            this.request._setState(name, value, options);
        }

        unstate(name, options) {

            this.request._clearState(name, options);
        }

        authenticated(data) {

            Hoek.assert(this._auth, 'Method not supported outside of authentication');
            Hoek.assert(data?.credentials, 'Authentication data missing credentials information');

            return new internals.Auth(null, data);
        }

        unauthenticated(error, data) {

            Hoek.assert(this._auth, 'Method not supported outside of authentication');
            Hoek.assert(!data || data.credentials, 'Authentication data missing credentials information');

            return new internals.Auth(error, data);
        }
    };

    Toolkit.prototype.abandon = exports.symbols.abandon;
    Toolkit.prototype.close = exports.symbols.close;
    Toolkit.prototype.continue = exports.symbols.continue;

    return Toolkit;
};


internals.Auth = class {

    constructor(error, data) {

        this.isAuth = true;
        this.error = error;
        this.data = data;
    }
};
