// Load modules

var Err = require('./error');
var Async = require('async');


// Declare internals

var internals = {
        requests: [],
        results: [],
        resultsMap: {}
    };


internals.batch = function(server, pos, parts, callback) {

    // Prepare request

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
            internals.results[pos] = result;
            internals.resultsMap[pos] = result;
            callback(null, result);
        });
    }
    else {
        internals.results[pos] = error;
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


internals.process = function(request) {

    var fnsParallel = [];
    var fnsSerial = [];
    var callBatch = function(pos, parts) {
        return function(callback) {
            internals.batch(request.server, pos, parts, callback);
        };
    };

    for(var i = 0, il = internals.requests.length; i < il; ++i) {
        var parts = internals.requests[i];

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
            request.reply(err);
        }
        else {
            request.reply(internals.results);
        }
    });
};


internals.handler = function(request) {

    internals.requests = [];
    internals.results = [];
    internals.resultsMap = [];
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
            internals.requests.push(parts);
        }
        else {
            errorMessage = errorMessage || 'Invalid request format (' + i + ')';
            break;
        }
    }

    if (errorMessage === null) {
        internals.process(request);
    }
    else {
        request.reply(Err.badRequest(errorMessage));
    }
};


exports.config =  {
    payload: 'parse',
    handler: internals.handler
};