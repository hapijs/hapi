/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var querystring = require("querystring");
var async = require('async');
var Client = require('./client');
var Process = null;                             // Delay load due to circular dependency


// Declare internals

var internals = {

    levels: ["debug", "info", "warn", "error"]
};


// Info

exports.info = function (message, req) {

    internals.log('info', message, req);
};


// Err

exports.err = function (error, req) {

    internals.log('err', error, req);
};


// Outbound callback

exports.outbound = null;


// Log output

internals.log = function (level, message, req) {

    if (Process === null) {

        Process = require('./process');
    }

    if (level === 'err' &&
        (typeof message === 'string' || message.code === 500)) {

        Process.reportError(message);
    }

    if (process.env.NODE_ENV === 'test') {

        return; // Silence log output during Jenkins test execution
    }

    if (Process.isInitialized === false ||
        Process.settings.log.levels[level]) {

        if (typeof message === 'string') {

            internals.print(level, message, req);
        }
        else if (req) {

            if (message.type === 'oauth') {

                internals.print(level, 'OAuth: ' + message.error + ' (' + message.text + ')', req);
            }
            else {

                internals.print(level, 'HTTP: ' + message.code + ' ' + (message.message || message.text), req);
            }

            if (message.log) {

                internals.print(level, 'Log: ' + JSON.stringify(message.log), req);
            }
        }
        else {

            internals.print(level, JSON.stringify(message));
        }
    }
};


// Package log for writing to external store

internals.pack = function (ts, level, msg, req) {

    var _package = {

        timestamp: ts,
        level: level,
        message: msg
    }

    if (typeof req !== "undefined" && req !== null) {

        if (typeof req === "object") {

            _package.cdr = querystring.stringify(req);
        } else {

            _package.cdr = req;
        }
    }

    return _package;
};


// Return true|false if loglevel within external store acceptable levels

internals.isWithinLevels = function (level, store) {

    var min = store.minLevel || -1;
    var max = store.maxLevel || internals.levels.length;
    var currentLevel = internals.levels.indexOf(level);

    if (currentLevel >= min && currentLevel <= max) {
        return true;
    }
    return false;
};


// Write log to external store

internals.send = function (ts, level, msg, req, callback) {

    callback = callback || function () { };

    async.forEach(Object.keys(exports.externalStores), function (host, complete) {

        if (internals.isWithinLevels(level, exports.externalStores[host])) {

            var uri = exports.externalStores[host].uri;
            var cli = new Client({ host: host });
            var data = internals.pack(ts, level, msg, req);

            cli.post(uri, data, function (err, res, body) {

                return complete(err);
            });
        }
    }, function finish(err) {

        return callback(err);
    });
};


// Format output

internals.print = function (level, message, req) {

    function pad(value) {

        return (value < 10 ? '0' : '') + value;
    }

    var now = new Date();
    var timestamp = (now.getYear() - 100).toString() +
                    pad(now.getMonth() + 1) +
                    pad(now.getDate()) +
                    '/' +
                    pad(now.getHours()) +
                    pad(now.getMinutes()) +
                    pad(now.getSeconds()) +
                    '.' +
                    now.getMilliseconds();

    if (typeof exports.externalStores !== 'undefined' &&
        exports.externalStores !== null) {

        internals.send(timestamp, level, message, req);
    }
    else {

        console.log(timestamp + ', ' + level + ', ' + message + (req ? ', ' + req.method + ', ' + req.url : ''));
    }
};


