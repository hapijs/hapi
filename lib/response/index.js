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
exports.Direct = internals.Direct = require('./direct');
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

    var prepareResponse = function(response, send) {

        if (response && typeof response._prepare === 'function') {
            response._prepare(send);
        }
        else {
            send(response);
        }
    };

    var handleErrors = function(preparedResponse) {

        if (!preparedResponse ||
            (!(preparedResponse instanceof internals.Base) && !(preparedResponse instanceof Err))) {

            preparedResponse = Err.internal('Unexpected response object', preparedResponse);
        }

        // Error object

        if (preparedResponse instanceof Err) {

            var errOptions = (request.server.settings.errors && request.server.settings.errors.format
                ? request.server.settings.errors.format(preparedResponse)
                : preparedResponse.toResponse());

            request.log(['http', 'response', 'error'], preparedResponse);
            preparedResponse = new internals.Error(errOptions);
        }

        return preparedResponse;
    };

    var formatHeaders = function(preparedResponse) {

        // Normalize Location header

        if (preparedResponse.headers.Location) {
            var uri = preparedResponse.headers.Location;
            var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
            preparedResponse.headers.Location = (isAbsolute ? uri : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
        }

        // Caching headers

        preparedResponse.header('Cache-Control', preparedResponse.ttlMsec ? 'max-age=' + Math.floor(preparedResponse.ttlMsec / 1000) : 'must-revalidate');

        // CORS headers

        if (request.server.settings.cors &&
            (!request._route || request._route.config.cors !== false)) {

            preparedResponse.header('Access-Control-Allow-Origin', request.server.settings.cors._origin);
            preparedResponse.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
            preparedResponse.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
            preparedResponse.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);
        }

        return preparedResponse;
    };

    var transmit = function(preparedResponse, callback) {

        // Injection

        if (preparedResponse.payload !== undefined) {                           // Value can be falsey
            if (Shot.isInjection(request.raw.req)) {
                request.raw.res.hapi = { result: preparedResponse.raw || preparedResponse.payload };
            }
        }

        preparedResponse._transmit(request, function () {

            request.log(['http', 'response', preparedResponse._tag]);
            return callback();
        });
    };

    prepareResponse(response, function(preparedResponse) {

        transmit(formatHeaders(handleErrors(preparedResponse)), callback);
    });
};
