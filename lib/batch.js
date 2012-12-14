// Load modules

var Async = require('async');
var Err = require('./error');


// Declare internals

var internals = {};


exports.config = {
    handler: function (request) {

        var resultsData = {
            results: [],
            resultsMap: []
        };

        var requests = [];
        var requestRegex = /(?:\/)(?:\$(\d)+\.)?([\w:\.]+)/g;       // /project/$1.project/tasks, does not allow using array responses

        // Validate requests

        var errorMessage = null;
        var parseRequest = function ($0, $1, $2) {

            if ($1) {
                if ($1 < i) {
                    parts.push({ type: 'ref', index: $1, value: $2 });
                    return '';
                }
                else {
                    errorMessage = 'Request reference is beyond array size (' + i + ')';
                    return $0;
                }
            }
            else {
                parts.push({ type: 'text', value: $2 });
                return '';
            }
        };

        if (!request.payload.requests) {
            return request.reply(Err.badRequest('Request missing requests array'));
        }

        for (var i = 0, il = request.payload.requests.length; i < il; ++i) {

            // Break into parts

            var parts = [];
            var result = request.payload.requests[i].path.replace(requestRegex, parseRequest);

            // Make sure entire string was processed (empty)

            if (result === '') {
                requests.push(parts);
            }
            else {
                errorMessage = errorMessage || 'Invalid request format (' + i + ')';
                break;
            }
        }

        if (errorMessage === null) {
            internals.process(request, requests, resultsData, request.reply);
        }
        else {
            request.reply(Err.badRequest(errorMessage));
        }
    }
};


internals.process = function (request, requests, resultsData, reply) {

    var fnsParallel = [];
    var fnsSerial = [];
    var callBatch = function (pos, parts) {

        return function (callback) {

            internals.batch(request, resultsData, pos, parts, callback);
        };
    };

    for (var i = 0, il = requests.length; i < il; ++i) {
        var parts = requests[i];

        if (internals.hasRefPart(parts)) {
            fnsSerial.push(callBatch(i, parts));
        }
        else {
            fnsParallel.push(callBatch(i, parts));
        }
    }

    Async.series([
        function (callback) {

            Async.parallel(fnsParallel, callback);
        },
        function (callback) {

            Async.series(fnsSerial, callback);
        }
    ], function (err) {

        if (err) {
            reply(err);
        }
        else {
            reply(resultsData.results);
        }
    });
};


internals.hasRefPart = function (parts) {

    for (var i = 0, il = parts.length; i < il; ++i) {
        if (parts[i].type === 'ref') {
            return true;
        }
    }

    return false;
};


internals.batch = function (request, resultsData, pos, parts, callback) {

    var path = '';
    var error = null;

    for (var i = 0, il = parts.length; i < il; ++i) {
        path += '/';

        if (parts[i].type === 'ref') {
            var ref = resultsData.resultsMap[parts[i].index];

            if (ref) {
                var value = null;

                try {
                    eval('value = ref.' + parts[i].value + ';');
                }
                catch (e) {
                    error = new Error(e.message);
                }

                if (value) {
                    if (value.match && value.match(/^[\w:]+$/)) {
                        path += value;
                    }
                    else {
                        error = new Error('Reference value includes illegal characters');
                        break;
                    }
                }
                else {
                    error = error || new Error('Reference not found');
                    break;
                }
            }
            else {
                error = new Error('Missing reference response');
                break;
            }
        }
        else {
            path += parts[i].value;
        }
    }

    if (error === null) {

        // Make request

        internals.dispatch(request, 'GET', path, null, function (data) {

            var result = data.result;
            resultsData.results[pos] = result;
            resultsData.resultsMap[pos] = result;
            callback(null, result);
        });
    }
    else {
        resultsData.results[pos] = error;
        callback(error);
    }
};


internals.dispatch = function (request, method, path, content, callback) {

    var body = (content !== null ? JSON.stringify(content) : null);     // content can be '' or 0
    var injectOptions = {
        url: path,
        method: method,
        payload: body,
        session: request.session
    };

    request.server.inject(injectOptions, callback);
};


