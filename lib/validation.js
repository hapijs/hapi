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

    return (rule === false) ?
        Joi.object({}).allow(null) :
        (typeof rule === 'function' ?
            rule :
            !rule || rule === true ? null : Joi.compile(rule));     // false tested earlier

};


exports.headers = function (request) {

    return internals.input('headers', request);
};


exports.params = function (request) {

    return internals.input('params', request);
};


exports.payload = function (request) {

    if (request.method === 'get' ||
        request.method === 'head') {                // When route.method is '*'

        return;
    }

    return internals.input('payload', request);
};


exports.query = function (request) {

    return internals.input('query', request);
};


internals.input = async function (source, request) {

    const localOptions = {
        context: {
            headers: request.headers,
            params: request.params,
            query: request.query,
            payload: request.payload,
            auth: request.auth,
            app: {
                route: request.route.settings.app,
                request: request.app
            }
        }
    };

    delete localOptions.context[source];
    Hoek.merge(localOptions, request.route.settings.validate.options);

    let value;
    let validationError;
    try {
        const schema = request.route.settings.validate[source];
        if (typeof schema !== 'function') {
            value = await Joi.validate(request[source], schema, localOptions);
        }
        else {
            const bind = request.route.settings.bind;
            value = await schema.call(bind, request[source], localOptions);
        }

        return;
    }
    catch (err) {
        validationError = (err.isJoi ? err : Boom.boomify(err));
    }
    finally {
        request.orig[source] = request[source];
        if (value !== undefined) {
            request[source] = value;
        }
    }

    if (request.route.settings.validate.failAction === 'ignore') {
        return;
    }

    // Prepare error

    const error = (validationError.isBoom ? validationError : Boom.badRequest(validationError.message, validationError));
    error.output.payload.validation = { source, keys: [] };
    if (validationError.details) {
        for (let i = 0; i < validationError.details.length; ++i) {
            const path = validationError.details[i].path;
            error.output.payload.validation.keys.push(Hoek.escapeHtml(path.join('.')));
        }
    }

    if (request.route.settings.validate.errorFields) {
        const fields = Object.keys(request.route.settings.validate.errorFields);
        for (let i = 0; i < fields.length; ++i) {
            const field = fields[i];
            error.output.payload[field] = request.route.settings.validate.errorFields[field];
        }
    }

    return request._core.toolkit.failAction(request, request.route.settings.validate.failAction, error, ['validation', 'error', source]);
};


exports.response = async function (request) {

    if (request.route.settings.response.sample) {
        const currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.settings.response.sample) {
            return;
        }
    }

    const response = request.response;
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    const statusSchema = request.route.settings.response.status[statusCode];
    if (statusCode >= 400 &&
        !statusSchema) {

        return;                 // Do not validate errors by default
    }

    const schema = statusSchema || request.route.settings.response.schema;
    if (schema === null) {
        return;                 // No rules
    }

    if (!response.isBoom &&
        request.response.variety !== 'plain') {

        throw Boom.badImplementation('Cannot validate non-object response');
    }

    const localOptions = {
        context: {
            headers: request.headers,
            params: request.params,
            query: request.query,
            payload: request.payload,
            auth: request.auth,
            app: {
                route: request.route.settings.app,
                request: request.app
            }
        }
    };

    const source = response.isBoom ? response.output.payload : response.source;
    Hoek.merge(localOptions, request.route.settings.response.options);

    try {
        let value;

        if (typeof schema !== 'function') {
            value = await Joi.validate(source, schema, localOptions);
        }
        else {
            value = await schema(source, localOptions);
        }

        if (value !== undefined &&
            request.route.settings.response.modify) {

            if (response.isBoom) {
                response.output.payload = value;
            }
            else {
                response.source = value;
            }
        }

        return;
    }
    catch (err) {

        return request._core.toolkit.failAction(request, request.route.settings.response.failAction, err, ['validation', 'response', 'error']);
    }
};
