'use strict';

const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');
const Validate = require('@hapi/validate');


const internals = {};


exports.validator = function (validator) {

    Hoek.assert(validator, 'Missing validator');
    Hoek.assert(typeof validator.compile === 'function', 'Invalid validator compile method');

    return validator;
};


exports.compile = function (rule, validator, realm, core) {

    validator = validator ?? internals.validator(realm, core);

    // false - nothing allowed

    if (rule === false) {
        return Validate.object({}).allow(null);
    }

    // Custom function

    if (typeof rule === 'function') {
        return rule;
    }

    // null, undefined, true - anything allowed

    if (!rule ||                            // false tested above
        rule === true) {

        return null;
    }

    // {...} - ... allowed

    if (typeof rule.validate === 'function') {
        return rule;
    }

    Hoek.assert(validator, 'Cannot set uncompiled validation rules without configuring a validator');
    return validator.compile(rule);
};


internals.validator = function (realm, core) {

    while (realm) {
        if (realm.validator) {
            return realm.validator;
        }

        realm = realm.parent;
    }

    return core.validator;
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


exports.state = function (request) {

    return internals.input('state', request);
};


internals.input = async function (source, request) {

    const localOptions = {
        context: {
            headers: request.headers,
            params: request.params,
            query: request.query,
            payload: request.payload,
            state: request.state,
            auth: request.auth,
            app: {
                route: request.route.settings.app,
                request: request.app
            }
        }
    };

    delete localOptions.context[source];
    Hoek.merge(localOptions, request.route.settings.validate.options);

    try {
        const schema = request.route.settings.validate[source];
        const bind = request.route.settings.bind;

        var value = await (typeof schema !== 'function' ? internals.validate(request[source], schema, localOptions) : schema.call(bind, request[source], localOptions));
        return;
    }
    catch (err) {
        var validationError = err;
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

    const defaultError = validationError.isBoom ? validationError : Boom.badRequest(`Invalid request ${source} input`);
    const detailedError = Boom.boomify(validationError, { statusCode: 400, override: false, data: { defaultError } });
    detailedError.output.payload.validation = { source, keys: [] };
    if (validationError.details) {
        for (const details of validationError.details) {
            const path = details.path;
            detailedError.output.payload.validation.keys.push(Hoek.escapeHtml(path.join('.')));
        }
    }

    if (request.route.settings.validate.errorFields) {
        for (const field in request.route.settings.validate.errorFields) {
            detailedError.output.payload[field] = request.route.settings.validate.errorFields[field];
        }
    }

    return request._core.toolkit.failAction(request, request.route.settings.validate.failAction, defaultError, { details: detailedError, tags: ['validation', 'error', source] });
};


exports.response = async function (request) {

    if (request.route.settings.response.sample) {
        const currentSample = Math.ceil(Math.random() * 100);
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

    const schema = statusSchema !== undefined ? statusSchema : request.route.settings.response.schema;
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
            state: request.state,
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
            value = await internals.validate(source, schema, localOptions);
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
    }
    catch (err) {
        return request._core.toolkit.failAction(request, request.route.settings.response.failAction, err, { tags: ['validation', 'response', 'error'] });
    }
};


internals.validate = function (value, schema, options) {

    if (typeof schema.validateAsync === 'function') {
        return schema.validateAsync(value, options);
    }

    return schema.validate(value, options);
};
