// Load modules

var Stream = require('stream');
var Shot = require('shot');
var Utils = require('../utils');
var Err = require('../error');
var Headers = require('./headers');


// Declare internals

var internals = {};


/*
            /-- Direct     /-- Stream -----|--- File
    Base --|              |
            \-- Generic --|--- Cache        /-- Text
                          |                |
                           \-- Cacheable --|--- Empty
                                           |
                                            \-- Object --|-- Error
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
exports.Direct = internals.Direct = require('./direct');

// Internal response types

internals.Error = require('./error');
internals.Cache = require('./cache');


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


exports._respond = function (item, request, callback) {

    var prepare = function (response) {

        if (!response ||
            (!(response instanceof internals.Base) && !(response instanceof Err))) {

            response = Err.internal('Unexpected response item', response);
        }

        if (response._prepare &&
            typeof response._prepare === 'function') {

            return response._prepare(send);
        }

        return send(response);
    };

    var send = function (response) {

        // Error object

        if (response instanceof Err) {
            var errOptions = (request.server.settings.format.error ? request.server.settings.format.error(response) : response.toResponse());
            request.log(['http', 'response', 'error'], response);
            response = new internals.Error(errOptions);
        }

        // Set Cache, CORS, Location headers

        Headers.set(response, request);

        // Injection

        if (response._payload !== undefined) {                           // Value can be falsey
            if (Shot.isInjection(request.raw.req)) {
                request.raw.res.hapi = { result: response._raw || response._payload };
            }
        }

        response._transmit(request, function () {

            request.log(['http', 'response', response._tag]);
            return callback();
        });
    };

    prepare(item);
};
