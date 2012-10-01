// Load modules

var Err = require('./error');
var Async = require('async');


// Declare internals

var internals = {
        requests: [],
        results: [],
        resultsMap: {}
    };


exports.init = function(server) {
    internals.server = server;

    return {
        payload: 'parse',
        handler: internals.handler
    };
};


internals.batch = function(pos, parts, callback) {

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

        internals.dispatch('GET', path, null, function (data) {
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

internals.dispatch = function (method, path, content, callback) {

    var body = content !== null ? JSON.stringify(content) : null;
    var injectOptions = {
        url: path,
        method: method,
        payload: body
    };

    internals.server.inject(injectOptions, callback);
};


internals.hasRefPart = function(parts) {

    for(var i = 0, il = parts.length; i < il; ++i) {
        if (parts[i].type === 'ref') {
            return true;
        }
    }

    return false;
};


internals.process = function(reply) {

    var fnsParallel = [];
    var fnsSerial = [];
    var callBatch = function(pos, parts) {
        return function(callback) {
            internals.batch(pos, parts, callback);
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
            reply(err);
        }
        else {
            reply(internals.results);
        }
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

    for (var i = 0, il = request.payload.requests.length; i < il; ++i) {
        // Break into parts

        var parts = [];
        var result = request.payload.requests[i].path.replace(requestRegex, parseRequest);

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
        internals.process(request.reply);
    }
    else {
        request.reply(Err.badRequest(error));
    }
};