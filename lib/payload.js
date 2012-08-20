/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Qs = require('querystring');
var Err = require('./error');


// Declare internals

var internals = {};


// Read and parse body

exports.read = function (request, config, next) {

    // Levels are: 'none', 'raw', 'parse'
    // Default is 'parse' for POST and PUT otherwise 'none'

    var level = (config.payload || (config.schema ? 'parse' : null)) || (request.method === 'post' || request.method === 'put' ? 'parse' : 'none');

    if (level === 'none') {

        return next();
    }

    // Check content type (defaults to 'application/json')

    var contentType = request.raw.req.headers['content-type'];
    var mime = (contentType ? contentType.split(';')[0] : 'application/json');
    var parserFunc = null;

    if (mime === 'application/json') {

        parserFunc = JSON.parse;
    }
    else if (mime === 'application/x-www-form-urlencoded') {

        parserFunc = Qs.parse;
    }
    else {

        return next(Err.badRequest('Unsupported content-type: ' + mime));
    }

    // Check content size

    var contentLength = request.raw.req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > request.server.settings.payload.maxBytes) {

        return next(Err.badRequest('Payload content length greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
    }

    // Read incoming payload

    var payload = '';
    var isBailed = false;

    request.raw.req.setEncoding('utf8');
    request.raw.req.addListener('data', function (chunk) {

        if (payload.length + chunk.length <= request.server.settings.payload.maxBytes) {

            payload += chunk;
        }
        else {

            isBailed = true;
            return next(Err.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
        }
    });

    request.raw.req.addListener('end', function () {

        if (isBailed) {

            return;
        }

        request.rawBody = payload;

        if (level === 'parse') {

            if (payload) {

                request.payload = {};

                try {

                    request.payload = parserFunc(payload);
                }
                catch (err) {

                    return next(Err.badRequest('Invalid JSON body'));
                }

                next();
            }
        }
    });
};

