'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');
const Joi = require('joi');


// Declare internals

const internals = {};


exports.compile = function (rule) {

    // null, undefined, true - anything allowed
    // false - nothing allowed
    // {...} - ... allowed

    return (rule === false ? Joi.object({}).allow(null)
                           : typeof rule === 'function' ? rule
                                                        : !rule || rule === true ? null                     // false tested earlier
                                                                                 : Joi.compile(rule));
};


exports.query = function (request, next) {

    return internals.input('query', request, next);
};


exports.payload = function (request, next) {

    if (request.method === 'get' ||
        request.method === 'head') {                // When route.method is '*'

        return next();
    }

    return internals.input('payload', request, next);
};


exports.params = function (request, next) {

    return internals.input('params', request, next);
};


exports.headers = function (request, next) {

    return internals.input('headers', request, next);
};


internals.input = function (source, request, next) {

    const postValidate = (err, value) => {

        request.orig[source] = request[source];
        if (value !== undefined) {
            request[source] = value;
        }

        if (!err) {
            return next();
        }

        if (err.isDeveloperError) {
            return next(err);
        }

        // failAction: 'error', 'log', 'ignore', function (source, err, next)

        if (request.route.settings.validate.failAction === 'ignore') {
            return next();
        }

        // Prepare error

        const error = (err.isBoom ? err : Boom.badRequest(err.message, err));
        error.output.payload.validation = { source, keys: [] };
        if (err.details) {
            for (let i = 0; i < err.details.length; ++i) {
                error.output.payload.validation.keys.push(Hoek.escapeHtml(err.details[i].path));
            }
        }

        if (request.route.settings.validate.errorFields) {
            const fields = Object.keys(request.route.settings.validate.errorFields);
            for (let i = 0; i < fields.length; ++i) {
                const field = fields[i];
                error.output.payload[field] = request.route.settings.validate.errorFields[field];
            }
        }

        request._log(['validation', 'error', source], error);

        // Log only

        if (request.route.settings.validate.failAction === 'log') {
            return next();
        }

        // Return error

        if (typeof request.route.settings.validate.failAction !== 'function') {
            return next(error);
        }

        // Custom handler

        request._protect.run(next, (exit) => {

            const reply = request.server._replier.interface(request, request.route.realm, {}, exit);
            request.route.settings.validate.failAction(request, reply, source, error);
        });
    };

    const localOptions = {
        context: {
            headers: request.headers,
            params: request.params,
            query: request.query,
            payload: request.payload,
            auth: request.auth
        }
    };

    delete localOptions.context[source];
    Hoek.merge(localOptions, request.route.settings.validate.options);

    const schema = request.route.settings.validate[source];
    if (typeof schema !== 'function') {
        return Joi.validate(request[source], schema, localOptions, postValidate);
    }

    request._protect.run(postValidate, (exit) => {

        const bind = request.route.settings.bind;
        return schema.call(bind, request[source], localOptions, exit);
    });
};


exports.response = function (request, next) {

    if (request.route.settings.response.sample) {
        const currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.settings.response.sample) {
            return next();
        }
    }

    const response = request.response;
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    const statusSchema = request.route.settings.response.status[statusCode];
    if (statusCode >= 400 &&
        !statusSchema) {

        return next();          // Do not validate errors by default
    }

    const schema = statusSchema || request.route.settings.response.schema;
    if (schema === null) {
        return next();          // No rules
    }

    if (!response.isBoom &&
        request.response.variety !== 'plain') {

        return next(Boom.badImplementation('Cannot validate non-object response'));
    }

    const postValidate = (err, value) => {

        if (!err) {
            if (value !== undefined &&
                request.route.settings.response.modify) {

                if (response.isBoom) {
                    response.output.payload = value;
                }
                else {
                    response.source = value;
                }
            }

            return next();
        }

        // failAction: 'error', 'log'

        if (request.route.settings.response.failAction === 'log') {
            request._log(['validation', 'response', 'error'], err.message);
            return next();
        }

        // Return error

        if (typeof request.route.settings.response.failAction !== 'function') {
            return next(Boom.badImplementation(err.message));
        }

        // Custom handler

        request._protect.run(next, (exit) => {

            const reply = request.server._replier.interface(request, request.route.realm, {}, exit);
            request.route.settings.response.failAction(request, reply, err);
        });
    };

    const localOptions = {
        context: {
            headers: request.headers,
            params: request.params,
            query: request.query,
            payload: request.payload,
            auth: {
                isAuthenticated: request.auth.isAuthenticated,
                credentials: request.auth.credentials
            }
        }
    };

    const source = response.isBoom ? response.output.payload : response.source;
    Hoek.merge(localOptions, request.route.settings.response.options);

    if (typeof schema !== 'function') {
        return Joi.validate(source, schema, localOptions, postValidate);
    }

    request._protect.run(postValidate, (exit) => {

        return schema(source, localOptions, exit);
    });
};
