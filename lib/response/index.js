// Load modules

var Stream = require('stream');
var Shot = require('shot');
var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


// Response types

exports.Base = internals.Base = require('./base');
exports.Generic = internals.Generic = require('./generic');
exports.Empty = internals.Empty = require('./empty');
exports.Obj = internals.Obj = require('./obj');
exports.Text = internals.Text = require('./text');
exports.Stream = internals.Stream = require('./stream');
exports.File = internals.File = require('./file');
internals.Error = require('./error');


// Utilities

exports.generateResponse = function (result, onSend) {

    var response = null;

    if (result === null ||
        result === undefined ||
        result === '') {

        response = new internals.Empty();
    }
    else if (typeof result === 'string') {
        response = new internals.Text(result);
    }
    else if (typeof result === 'object') {
        if (result instanceof Err) {
            response = result;
        }
        else if (result instanceof Error) {
            response = new Err(result);
        }
        else if (result instanceof Stream) {
            response = new internals.Stream(result);
        }
        else if (result instanceof internals.Base) {
            response = result;
        }
    }

    if (!response) {
        response = new internals.Obj(result);
    }

    Utils.assert(response && (response instanceof internals.Base || response instanceof Error), 'Response must be an instance of Error or Generic');   // Safety

    if (onSend) {
        response.send = function () {

            delete response.send;
            onSend();
        };
    }

    return response;
};


exports._respond = function (response, request, callback) {

    if (!response ||
        (!(response instanceof internals.Base) && !(response instanceof Err))) {

        response = Err.internal('Unexpected response object', response);
    }

    // Error object

    if (response instanceof Err) {

        var errOptions = (request.server.settings.errors && request.server.settings.errors.format
                                ? request.server.settings.errors.format(response)
                                : response.toResponse());

        request.log(['http', 'response', 'error'], response);
        response = new internals.Error(errOptions);
    }

    // Normalize Location header

    if (response.headers.Location) {
        var uri = response.headers.Location;
        var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
        response.headers.Location = (isAbsolute ? uri : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
    }

    // Caching headers

    response.header('Cache-Control', response.ttlMsec ? 'max-age=' + Math.floor(response.ttlMsec / 1000) : 'must-revalidate');

    // CORS headers

    if (request.server.settings.cors &&
        (!request._route || request._route.config.cors !== false)) {

        response.header('Access-Control-Allow-Origin', request.server.settings.cors._origin);
        response.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
        response.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
        response.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);
    }

    // Injection

    if (response.payload !== undefined) {                           // Value can be falsey
        if (Shot.isInjection(request.raw.req)) {
            request.raw.res.hapi = { result: response.raw || response.payload };
        }
    }

    // Response object

    response._transmit(request, function () {

        request.log(['http', 'response', response._tag]);
        return callback();
    });
};