/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Qs = require('querystring');
var Async = require('async');
var Client = require('./client');
var Process = null;                             // Delay load due to circular dependency


// Declare internals

var internals = {

    levels: ['info', 'error'],
    package: require(process.env.PWD + '/package.json')
};


// Info

exports.info = function (message, request) {

    internals.log('info', message, request);
};


// Err

exports.err = function (error, request) {

    internals.log('err', error, request);
};


// Outbound callback

exports.outbound = null;


// Log output

internals.log = function (level, message, request) {

    if (!Process) {
        Process = require('./process');
    }

    if (level === 'err' &&
        (typeof message === 'string' || (message !== null && typeof message === 'object' && message.code === 500))) {

        Process.reportError(message);
    }

    if (process.env.NODE_ENV === 'test') {
        return; // Silence log output during Jenkins test execution
    }

    if (Process.isInitialized === false ||
        (Process.settings.log && Process.settings.log.levels && Process.settings.log.levels[level])) {

        if (typeof message === 'string') {
            internals.print(level, message, request);
        }
        else if (request) {

            if (message.type === 'oauth') {
                internals.print(level, 'OAuth: ' + message.error + ' (' + message.text + ')', request);
            }
            else {
                internals.print(level, 'HTTP: ' + message.code + ' ' + (message.message || message.text), request);
            }

            if (message.log) {
                internals.print(level, 'Log: ' + JSON.stringify(message.log), request);
            }
        }
        else {
            internals.print(level, JSON.stringify(message));
        }
    }
};


// Package log for writing to external store

internals.pack = function (ts, level, msg, request) {

    var package = {

        timestamp: ts,
        level: level,
        message: msg
    }

    if (typeof request !== 'undefined' &&
        request &&
        request.raw &&
        request.raw.req) {

        if (typeof request.raw.req === 'object') {
            package.cdr = Qs.stringify(request.raw.req);
        }
        else {
            package.cdr = request.raw.req;
        }
    }

    return package;
};


// Return true|false if loglevel within external store acceptable levels

internals.isWithinLevels = function (level, store) {

    store = store || {};
    var min = store.minLevel || -1;
    var max = store.maxLevel || internals.levels.length;
    var currentLevel = internals.levels.indexOf(level);

    if (currentLevel >= min && currentLevel <= max) {
        return true;
    }

    return false;
};


// Write log to external store

internals.send = function (ts, level, msg, request, callback) {

    callback = callback || function () {};

    Async.forEach(Object.keys(exports.externalStores), function (host, complete) {

        if (internals.isWithinLevels(level, exports.externalStores[host])) {

            var uri = exports.externalStores[host].uri;
            var cli = new Client({ host: host });
            var events = internals.pack(ts, level, msg, request);

            // Anivia Schema related
            var data = {};
            data.appVer = internals.package.version || '0.0.1';
            data.host = require('os').hostname();
            data.module = 'Blammo';
            events.event = 'log';
            events.ets = events.timestamp;
            delete events.timestamp;
            data.events = [events];

            cli.post(uri, data, function (err, res, body) {
                return complete(err);
            });
        }
    },
    function finish(err) {
        return callback(err);
    });
};


// Format output

internals.print = function (level, message, request) {

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

        internals.send(timestamp, level, message, request);
    }
    else {
        console.log(timestamp + ', ' + level + ', ' + message + (request ? ', ' + request.method.toUpperCase() + ', ' + request.url.path : ''));
    }
};


