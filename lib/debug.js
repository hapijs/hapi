/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Os = require('os');
var Websocket = require('ws');
var Log = require('./log');


// Declare internals

var internals = {

    host: null,
    port: null,
    subscribers: {}             // Map: debug session -> [ subscriber ]
};


exports.report = function (session, event) {

    var subscribers = internals.subscribers[session];
    var valid = [];
    if (subscribers) {

        for (var i = 0, il = subscribers.length; i < il; ++i) {

            try {

                if (subscribers[i].readyState === Websocket.OPEN) {

                    subscribers[i].send(JSON.stringify(event, null, 4));
                    valid.push(subscribers[i]);
                }
            }
            catch (err) {
                // Remove subscriber on any send error
            }
        }

        internals.subscribers[session] = valid;
    }
};


exports.initialize = function (host, port) {

    internals.host = (host !== '0.0.0.0' ? host : Os.hostname());
    internals.port = port;

    var ws = new Websocket.Server({ host: host, port: port });
    ws.on('connection', function (socket) {

        socket.on('message', function (message) {

            internals.subscribers[message] = internals.subscribers[message] || [];
            internals.subscribers[message].push(socket);
            Log.info('Debug subscription requested: ' + message);
        });
    });
};


exports.console = {

    auth: {
        mode: 'none'
    },

    handler: function (request) {

        var html = '<!DOCTYPE html><html lang="en"><head><title>Debug Console</title><meta http-equiv="Content-Language" content="en-us"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>' +
        '<script>\n' +
        'function htmlEscape(string) { return string.replace(/&/g,"&amp;").replace(/>/g,"&gt;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}\n' +
        'var ws = new WebSocket("ws://' + internals.host + ':' + internals.port + '");\n' +
        'ws.onopen = function() {};\n' +
        'ws.onmessage = function(message) { document.getElementById("stream").innerHTML += htmlEscape(message.data) + "<p />" };\n' +
        'ws.onclose = function() {};\n' +
        '</script>\n' +
        '<input id="session" /><button id="subscribe" onclick="ws.send(document.getElementById(\'session\').value);">Subscribe</button>' +
        '<pre><div id="stream"></div></pre></body></html>';

        request.reply(html);
    }
};



