// Load modules

var Fs = require('fs');
var Async = require('async');
var Client = require('../client');
var Log = require('../log');
var Utils = require('../utils');
var NodeOs = require('os');
var Os = require('./os');
var Process = require('./process');


// Declare internals

var internals = {
    hostname: NodeOs.hostname()
};


/**
* Monitor Constructor
*
* @param {Object} server (HTTP Server), must be an EventEmitter
* @param {Object} options object with configuration
* @api public
*/
module.exports = Monitor = function (server, options) {

    // Public properties

    this.clients = {};
    this.timer = null;
    this.server = server;
    this.settings = Utils.clone(options) || {};
    this.version = Utils.loadPackage().version || 'unknown';

    // Validate settings

    Utils.assert(this.settings.opsInterval > 0 || !this.settings.ops, 'Missing monitor.opsInterval configuration');

    // Load process level functions

    this.process = new Process.Monitor();

    // Load OS level functions

    this.os = new Os.Monitor();

    // Initialize Events

    if (this.settings.ops &&
        this.settings.ops.length) {

        this._initOps();
    }

    if (this.settings.requests &&
        this.settings.requests.length) {

        this.server.on('response', this._handle('request'));
        Log.event(['info', 'config'], 'Requests monitoring enabled');
    }

    if (this.settings.log &&
        this.settings.log.length) {

        Log.on('log', this._handle('log'));
        Log.event(['info', 'config'], 'Log monitoring enabled');
    }
};


/**
* Initialize Operations Monitoring if configured
*
* @api private
*/
Monitor.prototype._initOps = function () {

    var self = this;

    // Subscribe to opts interval

    this.server.on('ops', this._handle('ops'));

    // Set ops interval timer

    var opsFunc = function () {

        // Gather operational statistics in parallel

        Async.parallel({

            oscpu: this.os.cpu,
            osdisk: this.os.disk,
            osload: this.os.loadavg,
            osmem: this.os.mem,
            osup: this.os.uptime,
            psup: this.process.uptime,
            psmem: this.process.memory,
            pscpu: this.process.cpu
        },
        function (err, results) {

            if (!err) {
                self.server.emit('ops', results);
            }
            else {
                Log.event(['err', 'monitor', 'ops'], err);
            }
        })
    };

    setInterval(opsFunc, this.settings.opsInterval);
    Log.event(['info', 'config'], 'Ops monitoring enabled');
};


/**
* Get a Hapi HTTP Client
*
* @param {String} host Base URL for the HTTP Client
* @api public
*/
Monitor.prototype.getClient = function (host) {

    if (this.clients.hasOwnProperty(host)) {
        return this.clients[host];
    }
    else {

        this.clients[host] = new Client({ host: host });
        return this.clients[host];
    }
};


/**
* Respond to Monitoring Signals and dispatch handlers
*
* @param {String} eventName signal name
* @api public
*/
Monitor.prototype._handle = function (eventName) {

    var self = this;

    return function (context) {

        if (typeof self.settings[eventName] !== 'undefined' &&
            self.settings[eventName] !== null) {

            var hosts = self.settings[eventName];
            for (var i = 0, il = hosts.length; i < il; ++i) {

                var host = hosts[i];
                var client = self.getClient(host);

                self._eventHandlers[eventName](client, host)(context);
            }
        }
    };
};


/**
* Namespace for event handlers
*
* @api private
*/
Monitor.prototype._eventHandlers = {};


/**
* Generate and send Operational Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
Monitor.prototype._eventHandlers.ops = function (client, url) {

    var self = this;
    return function (results) {

        var data = {

            module: 'hapi',
            appVer: self.version,
            host: internals.hostname,
            events: [
                {
                    event: 'op', // required: eventType
                    os: {

                        load: results.osload,
                        mem: results.osmem,
                        disk: results.osdisk,
                        uptime: results.osup
                        // io: '', // Not yet implemented
                        // net: '' // Not yet implemented
                    },
                    proc: {

                        uptime: results.psup,
                        mem: results.psmem,
                        cpu: results.pscpu
                    },
                    ets: new Date().getTime() // required
                }
            ]
        };

        if (results.oscpu !== null && results.oscpu !== '-') {
            data.events[0].os.cpu = results.oscpu;
        }

        client.post(url, data, function (err, res, body) { });
    }
};


/**
* Generate and send Request Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
Monitor.prototype._eventHandlers.request = function (client, url) {

    var self = this;

    return function (request) {

        var req = request.raw.req;
        var res = request.raw.res;

        var modified_headers = Utils.clone(req.headers);

        delete modified_headers['host'];
        delete modified_headers['connection'];
        modified_headers['remote-address'] = req.connection.remoteAddress;

        // Response Header is already stringified, parse to get content length
        var clengthPattern = /content-length: (\d+)/;
        var match = clengthPattern.exec(res._header);
        if (!match) {
            var contentLength = 0;
        }
        else {
            var contentLength = parseInt(clengthPattern.exec(res._header)[1]);
        }

        var data = {

            module: 'hapi',
            host: internals.hostname,
            appVer: self.version,
            events: [
                {
                    event: 'request',
                    headers: modified_headers,
                    responseTime: (new Date()) - request._analytics.startTime,
                    responseSize: contentLength,
                    ets: Utils.getTimestamp()
                }
            ]
        }

        client.post(url, data, function (err, res, body) { });
    };
};


/**
* Generate and send logs events
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
Monitor.prototype._eventHandlers.log = function (client, url) {

    var self = this;

    return function (event) {

        var data = {

            module: 'hapi',
            host: internals.hostname,
            appVer: self.version,
            data: [{

                event: 'log',
                ts: event.timestamp,
                tags: event.tags,
                data: event.data
            }]
        };

        client.post(url, data, function (err, res, body) { });
    };
};

