// Load modules

var Os = require('os');
var Websocket = require('ws');
var Log = require('./log');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports.Console = internals.Console = function (server) {

    var self = this;

    this.server = server;
    this.settings = Utils.clone(this.server.settings.debug) || {};
    this._subscribers = {};                                             // Map: debug session -> [ subscriber ]

    var ws = new Websocket.Server({ host: this.server.settings.host, port: this.settings.websocketPort });
    ws.on('connection', function (socket) {

        socket.on('message', function (message) {

            if (message) {
                self._subscribers[message] = self._subscribers[message] || [];
                self._subscribers[message].push(socket);
                Log.event('info', 'Debug subscription requested: ' + message);
            }
        });
    });
};


internals.Console.prototype.report = function (session, event) {

    var self = this;

    var transmit = function (key) {

        var subscribers = self._subscribers[key];
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

            self._subscribers[key] = valid;
        }
    };

    if (session) {
        transmit(session);
    }

    transmit('*');
};


internals.Console.prototype.endpoint = function () {

    var host = (this.server.settings.host !== '0.0.0.0' ? this.server.settings.host : Os.hostname());
    var port = this.settings.websocketPort;

    return {
        auth: {
            mode: 'none'
        },
        handler: function (request) {

            var html = '<!DOCTYPE html><html lang="en"><head><title>Debug Console</title><meta http-equiv="Content-Language" content="en-us"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>' +
            '<script>\n' +
            'function htmlEscape(string) { return string.replace(/&/g,"&amp;").replace(/>/g,"&gt;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}\n' +
            'var ws = new WebSocket("ws://' + host + ':' + port + '");\n' +
            'ws.onopen = function() {};\n' +
            'ws.onmessage = function(message) { document.getElementById("stream").innerHTML += htmlEscape(message.data) + "<p />" };\n' +
            'ws.onclose = function() {};\n' +
            '</script>\n' +
            '<input id="session" /><button id="subscribe" onclick="ws.send(document.getElementById(\'session\').value);">Subscribe</button>' +
            '<pre><div id="stream"></div></pre></body></html>';

            request.reply(html);
        }
    };
};



