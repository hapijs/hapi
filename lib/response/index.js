// Load modules

var Stream = require('stream');
var Boom = require('boom');
var Shot = require('shot');
var Utils = require('../utils');


// Declare internals

var internals = {};


/*
            /-- Raw        /-- Stream -----|--- File
    Base --|              |
            \-- Generic --|                 /-- Text ----|-- Redirection
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

exports.Base = internals.Base = require('./base');
exports.Generic = internals.Generic = require('./generic');
exports.Cacheable = internals.Cacheable = require('./cacheable');

// Basic response types

exports.Empty = internals.Empty = require('./empty');
exports.Obj = internals.Obj = require('./obj');
exports.Text = internals.Text = require('./text');
exports.Stream = internals.Stream = require('./stream');
exports.File = internals.File = require('./file');
exports.Directory = internals.Directory = require('./directory');
exports.Raw = internals.Raw = require('./raw');
exports.Redirection = internals.Redirection = require('./redirection');
exports.View = internals.View = require('./view');

// Internal response types

internals.Error = require('./error');
internals.Cached = require('./cached');


// Utilities

exports.generate = function (result, onSend) {

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
        if (result.variety ||
            result.isBoom) {

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

    Utils.assert(response && (response.variety || response.isBoom), 'Invalid response object');   // Safety

    if (onSend) {
        response.send = function () {

            delete response.send;
            onSend();
        };
    }

    return response;
};


exports._respond = function (item, request, callback) {

    var errorPrepared = false;

    var prepare = function (response) {

        if (!response ||
            (!response.variety && !response.isBoom)) {

            response = Boom.internal('Unexpected response item', response);
        }

        if (response._prepare &&
            typeof response._prepare === 'function') {

            return response._prepare(request, send);
        }

        return send(response);
    };

    var send = function (response) {

        // Error object

        if (response.isBoom) {
            request.log(['http', 'response'], response);
            response = new internals.Error(response.response);

            if (!errorPrepared) {                                   // Prevents a loop if _prepare returns an error
                errorPrepared = true;
                return response._prepare(request, send);
            }
        }

        if (request.method === 'get' || request.method === 'head') {

            // Process ETag and If-Modified-Since headers

            var ifModifiedSince = request.raw.req.headers['if-modified-since'] ? Date.parse(request.raw.req.headers['if-modified-since']) : null;
            var lastModified = response._headers && response._headers['Last-Modified'] ? Date.parse(response._headers['Last-Modified']) : null;
            var etag = response._headers ? response._headers.etag : null;

            if ((etag && request.raw.req.headers['if-none-match'] === etag) ||
                (ifModifiedSince && lastModified && ifModifiedSince >= lastModified)) {

                response = new internals.Empty();
                response._code = 304;
            }
        }

        // Injection

        if (response._payload !== undefined) {                           // Value can be falsey
            if (Shot.isInjection(request.raw.req)) {
                request.raw.res.hapi = { result: response.raw || response._payload };
            }
        }

        response._transmit(request, function () {

            request.log(['http', 'response', response.variety]);
            return callback();
        });
    };

    prepare(item);
};
