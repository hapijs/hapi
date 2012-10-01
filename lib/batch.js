/*
 * Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
 * See LICENSE file included with this code project for license terms.
 */

// Load modules

var Err = require('./error');

// Declare internals

var internals = {
        requests: [],
        results: [],
        resultsMap: {}
    };

internals.batch = function(request, pos, callback) {

    if (pos >= internals.requests.length) {
        callback();
    }
    else {
        // Prepare request

        var parts = internals.requests[pos];
        var path = '';
        var error = null;

        for (var i = 0, il = parts.length; i < il; ++i) {

            path += '/';

            if (parts[i].type === 'ref') {

                var ref = internals.resultsMap[parts[i].index];
                if (ref) {

                    var value = null;

                    try {

                        eval('value = ref.' + parts[i].value + ';');
                    }
                    catch (e) {

                        error = e.message;
                    }

                    if (value) {

                        if (value.match(/^[\w:]+$/)) {

                            path += value;
                        }
                        else {

                            error = 'Reference value includes illegal characters';
                            break;
                        }
                    }
                    else {

                        error = error || 'Reference not found';
                        break;
                    }
                }
                else {

                    error = 'Missing reference response';
                    break;
                }
            }
            else {

                path += parts[i].value;
            }
        }

        if (error === null) {

            // Make request

            internals.dispatch('GET', path, null, request.server, function (data) {

                internals.results.push(data.result);
                internals.resultsMap[pos] = data.result;

                // Call next

                internals.batch(request, pos + 1, callback);
            });
        }
        else {

            // Set error response (as string)

            internals.results.push(error);

            // Call next

            internals.batch(request, pos + 1, callback);
        }
    }
};

// Make API call

internals.dispatch = function (method, path, content, server, callback) {

    var body = content !== null ? JSON.stringify(content) : null;
    var injectOptions = {
        url: path,
        method: method,
        payload: body
    };

    server.inject(injectOptions, callback);
};

internals.process = function(request) {

    internals.batch(request, 0, function () {

        // Return results

        request.reply(internals.results);
    });
};

internals.handler = function(request) {

    internals.requests = [];
    internals.results = [];
    internals.resultsMap = [];
    var requestRegex = /(?:\/)(?:\$(\d)+\.)?([\w:\.]+)/g;       // /project/$1.project/tasks, does not allow using array responses

    // Validate requests

    var error = null;
    var parseRequest = function ($0, $1, $2) {

        if ($1) {

            if ($1 < i) {

                if ($1.indexOf(':') === -1) {

                    parts.push({ type: 'ref', index: $1, value: $2 });
                    return '';
                }
                else {

                    error = 'Request reference includes invalid ":" character (' + i + ')';
                    return $0;
                }
            }
            else {

                error = 'Request reference is beyond array size (' + i + ')';
                return $0;
            }
        }
        else {

            parts.push({ type: 'text', value: $2 });
            return '';
        }
    };

    for (var i = 0, il = request.payload.get.length; i < il; ++i) {

        // Break into parts

        var parts = [];
        var result = request.payload.get[i].replace(requestRegex, parseRequest);

        // Make sure entire string was processed (empty)

        if (result === '') {
            internals.requests.push(parts);
        }
        else {

            error = error || 'Invalid request format (' + i + ')';
            break;
        }
    }

    if (error === null) {
        internals.process(request);
    }
    else {
        request.reply(Err.badRequest(error));
    }
};

exports.config = {

    payload: 'parse',
    handler: internals.handler
};