// Load modules

var Stream = require('stream');
var Boom = require('boom');
var Shot = require('shot');
var Utils = require('../utils');


// Declare internals

var internals = {
    maxNestedPreparations: 5
};


/*
               /-- Stream -----|--- File
              |
    Generic --|--- Buffer       /-- Text ----|-- Redirection
              |                |
               \-- Cacheable --|--- Empty
                               |
                               |-- Directory
                               |
                               |--- Object --|-- Error
                               |
                               |--- Cached
                               |
                                \-- View
*/

// Prototype response types

exports.Generic = internals.Generic = require('./generic');
exports.Cacheable = internals.Cacheable = require('./cacheable');

// Basic response types

exports.Empty = internals.Empty = require('./empty');
exports.Obj = internals.Obj = require('./obj');
exports.Text = internals.Text = require('./text');
exports.Stream = internals.Stream = require('./stream');
exports.File = internals.File = require('./file');
exports.Redirection = internals.Redirection = require('./redirection');
exports.View = internals.View = require('./view');
exports.Buffer = internals.Buffer = require('./buffer');

// Internal response types

internals.Error = require('./error');
internals.Cached = require('./cached');


// Utilities

exports._generate = function (result, onSend) {

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
        if (Buffer.isBuffer(result)) {
            response = new internals.Buffer(result);
        }
        else if (result.isHapiResponse ||
                 (result.isBoom && result instanceof Error)) {      // Checking 'instanceof Boom' is unreliable

            response = result;
        }
        else if (result instanceof Error) {
            response = new Boom(result);
        }
        else if (result instanceof Stream) {
            response = new internals.Stream(result);
        }
    }

    if (!response) {
        response = new internals.Obj(result);
    }

    if (!onSend) {
        return response;
    }

    response.hold = function () {

        delete response.hold;

        response.send = function () {

            delete response.send;
            onSend(response);
        };

        return response;
    };

    process.nextTick(function () {

        delete response.hold;

        if (!response.send) {
            onSend(response);
        }
    });

    return response;
};


exports._respond = function (item, request, callback) {

    var errorPrepared = false;
    var prepareCount = 0;

    var prepare = function (response) {

        if (!response ||
            (!response.variety && !response.isBoom)) {

            response = Boom.internal('Unexpected response item', response);
        }

        if (response.isBoom) {
            response = new internals.Error(response);
        }

        if (!response._prepare) {
            return etag(response);
        }

        response._prepare(request, function (result) {

            if (!result._wasPrepared) {
                ++prepareCount;
                if (prepareCount > internals.maxNestedPreparations) {    // Prevent prepare loops
                    result = new internals.Error(Boom.internal('Response prepare count exceeded maximum allowed', item));
                    return send(result);
                }

                if (result.isBoom) {
                    if (errorPrepared) {
                        return send(new internals.Error(result));
                    }

                    errorPrepared = true;                                   // Prevent error loops
                }

                return prepare(result);
            }

            return etag(result);
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return send(response);
        }

        // Process ETag

        var etag = response._headers && response._headers.etag;
        if (etag &&
            request.raw.req.headers['if-none-match'] === etag) {

            var unchanged = new internals.Empty();
            unchanged.code(304);
            return prepare(unchanged);
        }

        // Process If-Modified-Since headers

        var ifModifiedSinceHeader = request.raw.req.headers['if-modified-since'];
        var lastModifiedHeader = response._headers && response._headers['Last-Modified'];

        if (ifModifiedSinceHeader &&
            lastModifiedHeader) {

            var ifModifiedSince = Date.parse(ifModifiedSinceHeader);
            var lastModified = Date.parse(lastModifiedHeader);

            if (ifModifiedSince &&
                lastModified &&
                ifModifiedSince >= lastModified) {

                var unchanged = new internals.Empty();
                unchanged.code(304);
                return prepare(unchanged);
            }
        }

        return send(response);
    };

    var send = function (response) {

        // Injection

        if (response._payload &&
            response._payload.length) {

            if (Shot.isInjection(request.raw.req) &&
                response.hasOwnProperty('raw')) {

                request.raw.res.hapi = { result: response.raw };
            }
        }

        response._transmit(request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response', response.variety]);
            return callback();
        });
    };

    prepare(item);
};


