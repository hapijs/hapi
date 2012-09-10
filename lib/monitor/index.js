// Load modules

var Os = require('os');
var Async = require('async');
var Request = require('request');
var Log = require('../log');
var Utils = require('../utils');
var System = require('./system');
var Process = require('./process');


// Declare internals

var internals = {
    hostname: Os.hostname(),
    version: Utils.loadPackage().version || 'unknown'
};


/**
* Monitor Constructor
*
* @param {Object} server (HTTP Server), must be an EventEmitter
* @param {Object} options object with configuration
* @api public
*/
module.exports = internals.Monitor = function (server, options) {

    // Public properties

    this.clients = {};
    this.timer = null;
    this.server = server;
    this.settings = Utils.clone(options) || {};

    // Validate settings

    Utils.assert(this.settings.opsInterval > 0 || !this.settings.ops, 'Missing monitor.opsInterval configuration');

    // Load process level functions

    this.process = new Process.Monitor();

    // Load OS level functions

    this.os = new System.Monitor();

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
internals.Monitor.prototype._initOps = function () {

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
* Respond to Monitoring Signals and dispatch handlers
*
* @param {String} eventName signal name
* @api public
*/
internals.Monitor.prototype._handle = function (eventName) {

    var self = this;

    return function (context) {

        var data = self._eventHandlers[eventName]()(context);

        var hosts = self.settings[eventName];
        for (var i = 0, il = hosts.length; i < il; ++i) {
            var host = hosts[i];
            var client = self.getClient(host);

            data.mts = Utils.getTimestamp();

            var request = {
                method: 'post',
                uri: path,
                json: data
            };

            Request(request, function (err, res, body) {

                // Ignore errors
            });
        }
    };
};


/**
* Namespace for event handlers
*
* @api private
*/
internals.Monitor.prototype._eventHandlers = {};


/**
* Generate and send Operational Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
internals.Monitor.prototype._eventHandlers.ops = function () {

    var self = this;

    return function (results) {

        var data = {
            module: 'hapi',
            appVer: internals.version,
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

        return data;
    }
};


/**
* Generate and send Request Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
internals.Monitor.prototype._eventHandlers.request = function () {

    var self = this;

    return function (request) {

        var req = request.raw.req;

        var data = {
            module: 'hapi',
            host: internals.hostname,
            appVer: internals.version,
            events: [
                {
                    event: 'request',
                    source: {
                        remoteAddress: req.connection.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        referer: req.headers.referer
                    },
                    responseTime: (new Date()) - request._analytics.startTime,
                    log: request._log,
                    ets: Utils.getTimestamp()
                }
            ]
        }

        return data;
    };
};


/**
* Generate and send logs events
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
internals.Monitor.prototype._eventHandlers.log = function () {

    var self = this;

    return function (event) {

        var data = {
            module: 'hapi',
            host: internals.hostname,
            appVer: internals.version,
            data: [{
                event: 'log',
                ts: event.timestamp,
                tags: event.tags,
                data: event.data
            }]
        };

        return data;
    };
};

