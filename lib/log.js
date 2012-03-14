/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Process = require('./process');


// Declare internals

var internals = {};


// Info

exports.info = function (message, req) {

    internals.log('info', message, req);
};


// Err

exports.err = function (error, req) {

    internals.log('err', error, req);
};


// Log output

internals.log = function (level, message, req) {

    if (process.env.NODE_ENV === 'test') {

        return;
    }

    if (Process.settings === null || Process.settings.log.levels[level]) {

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

    console.log(timestamp + ', ' + level + ', ' + message + (req ? ', ' + req.method + ', ' + req.url : ''));
};
