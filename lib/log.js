// Load modules

var Async = require('async');
var Client = require('./client');


// Declare internals

var internals = {
    package: require(process.env.PWD + '/package.json')
};


// Info

exports.info = function (message) {

    internals.log('info', message);
};


// Err

exports.err = function (error) {

    internals.log('err', error);
};


// Log output

internals.log = function (level, message) {

    if (process.env.NODE_ENV === 'test') {
        return;                                         // Silence log output during Jenkins test execution
    }

    if (typeof message === 'string') {
        internals.print(level, message);
    }
    else {
        internals.print(level, JSON.stringify(message));
    }
};


// Write log to external store

internals.send = function (ts, level, msg) {

    Async.forEach(Object.keys(exports.externalStores), function (host, complete) {

        var uri = exports.externalStores[host].uri;
        var cli = new Client({ host: host });
        var events = {

            timestamp: ts,
            level: level,
            message: msg
        };

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
    },
    function finish(err) {
    });
};


// Format output

internals.print = function (level, message) {

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

        internals.send(timestamp, level, message);
    }
    else {
        console.log(timestamp + ', ' + level + ', ' + message);
    }
};


