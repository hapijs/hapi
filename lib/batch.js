// Load modules

var Err = require('./error');
var Async = require('async');


// Declare internals

var internals = {};


internals.handler = function(request) {

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
                if ($1.indexOf(':') === -1) {
                    parts.push({ type: 'ref', index: $1, value: $2 });
                    return '';
                }
                else {
                    errorMessage = 'Request reference includes invalid ":" character (' + i + ')';
                    return $0;
                }
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
        internals.process(request.server, requests, resultsData, request.reply);
    }
    else {
        request.reply(Err.badRequest(errorMessage));
    }
};


internals.batch = function(server, resultsData, pos, parts, callback) {

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
                    if (value.match(/^[\w:]+$/)) {
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

        internals.dispatch(server, 'GET', path, null, function (data) {
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


// Make API call

internals.dispatch = function (server, method, path, content, callback) {

    var body = content !== null ? JSON.stringify(content) : null;
    var injectOptions = {
        url: path,
        method: method,
        payload: body
    };

    server.inject(injectOptions, callback);
};


internals.hasRefPart = function(parts) {

    for(var i = 0, il = parts.length; i < il; ++i) {
        if (parts[i].type === 'ref') {
            return true;
        }
    }

    return false;
};


internals.process = function(server, requests, resultsData, reply) {

    var fnsParallel = [];
    var fnsSerial = [];
    var callBatch = function(pos, parts) {
        return function(callback) {
            internals.batch(server, resultsData, pos, parts, callback);
        };
    };

    for(var i = 0, il = requests.length; i < il; ++i) {
        var parts = requests[i];

        if(internals.hasRefPart(parts)) {
            fnsSerial.push(callBatch(i, parts));
        }
        else {
            fnsParallel.push(callBatch(i, parts));
        }
    }

    Async.series([
        function(callback) {
            Async.parallel(fnsParallel, callback);
        },
        function(callback) {
            Async.series(fnsSerial, callback);
        }
    ], function(err, results) {
        if (err) {
            reply(err);
        }
        else {
            reply(resultsData.results);
        }
    });
};


exports.config = {
    handler: internals.handler
}