/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Async = require('async');
var Client = require('../client');
var Utils = require('../utils');
var Os = require('./os');
var Process = require('./process');

// Declare internals

var internals = {};


/**
* Monitor Constructor
*
* @param {Object} server (HTTP Server), must be an EventEmitter
* @param {Object} settings object with configuration
* @param {Function} logger instance
* @api public
*/
module.exports = Monitor = function (server, settings, logger) {

    // Public properties

    this.clients = {};
    this.timer = null;
    this.server = server;
    this.options = Utils.merge({}, settings || {});
    this.package = this._loadPackage();
    this.logger = logger;

    if (this.options && this.options.monitor) {

        // Load process level functions

        this.process = new Process.Monitor();

        // Load OS level functions

        this.os = new Os.Monitor();

        // Initialize Events

        this._initOps();
        this._initRequests();
        this._initLogs();
    }
    else {

        this.logger.info("Hapi monitoring is disabled");
    }
};


/**
* Load and parse package.json from instance of web server
*
* @param {String} rootdir path to root directory
* @api private
*/
Monitor.prototype._loadPackage = function(rootdir) {

    rootdir = rootdir || process.env.PWD;
    var path = require('path'),
        fs = require('fs'),
        filepath = rootdir + "/package.json";

    if (path.existsSync(rootdir)) {

        try {

            var package = require(filepath);
        }
        catch (e) {

            try {

                var package = JSON.parse(fs.readFileSync(filepath));
            }
            catch (e) {

                this.logger("Error parsing package.json at: " + filepath);
                throw e;
            }
        }

        return package;
    }
    else {

        return {}
    }
}


/**
* Initialize Operations Monitoring if configured
*
* @api private
*/
Monitor.prototype._initOps = function() {

    var that = this;
    if (typeof this.options.monitor.ops !== "undefined" &&
        this.options.monitor.ops !== null) {

        if (this.options.monitor.interval &&
            Object.keys(this.options.monitor.ops).length > 0) {

            this.ops_interval = setInterval((function(){

                that.processOps(function(err, results) {

                    if (err === null) {

                        that.server.emit('ops', results);
                    }
                    else {

                        that.logger.err(err);
                    }
                })
            }));
            
            // Support user-defined binds via config
            // Also, support multiple outbound locations
            
            var useDefault = true;
            for(var posturl in Object.keys(this.options.monitor.ops)) {

                if (typeof this.options.monitor.ops[posturl] == "function") {

                    this.server.on('ops', this.options.monitor.ops[posturl]);
                    useDefault = false;
                }
            }
            
            if (useDefault == true) {

                this.server.on('ops', this.handle('ops'));
            }
        }
        else {

            this.logger.err("'interval' setting must be also be supplied with 'ops'");
        }
    }
    else {

        this.logger.info("Hapi will not be monitoring ops data");
    }
}


/**
* Initial Request Monitoring if configured
*
* @api private
*/
Monitor.prototype._initRequests = function() {

    if (this.options.monitor.request &&
        Object.keys(this.options.monitor.request).length >0) {

        var useDefault = true;
        for(var posturl in Object.keys(this.options.monitor.request)) {

            if (typeof this.options.monitor.request[posturl] == "function") {

                this.server.on('response', this.options.monitor.request[posturl]);
                useDefault = false;
            }
        }
        
        if (useDefault == true) {

            this.server.on('response', this.handle('request'));
        }
    }
    else {

        this.logger.info("Hapi will not be monitoring request responses");
    }
}


/**
* Initial Log Monitoring if configured
*
* @api private
*/
Monitor.prototype._initLogs = function() {

    if (this.options.monitor.log &&
        Object.keys(this.options.monitor.log).length >0) {

        this.logger.externalStores = this.options.monitor.log;
    }
    else {

        this.logger.info("Hapi will be logging to stdout");
    }
}


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
* Generate and send Request Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
Monitor.prototype._request = function (client, url) {

    var that = this;
    return function (req, res) {

        var modified_headers = Utils.clone(req.headers);

        delete modified_headers['host'];
        delete modified_headers['connection'];
        modified_headers['remote-address'] = req.connection.remoteAddress;

        // Response Header is already stringified, parse to get content length
        var clengthPattern = /content-length: (\d+)/;
        var match = clengthPattern.exec(res._header);
        if (match === null) {

            var contentLength = 0;
        }
        else {

            var contentLength = parseInt(clengthPattern.exec(res._header)[1]);
        }
        
        // Note: Anivia-specific schema
        
        var data = {

            module: 'Blammo',
            host: require('os').hostname(),
            appVer: that.package.version || "0.0.1",
            events: [
                {
                    event: 'request',
                    headers: modified_headers,
                    responseTime: new Date - req._startTime,
                    responseSize: contentLength, // res._headers['content-length'], // Express version
                    ets: new Date().getTime()
                }
            ]
        }
        
        // console.log('request', url, JSON.stringify(data, null, 2));
        
        client.post(url, data, function (err, res, body) { });
    };
};


/**
* Gather Operational Statistics in Parallel
*
* @param {Function} callback to receive resulting data
* @api public
*/
Monitor.prototype.processOps = function(callback) {

    Async.parallel({

        oscpu: this.os.cpu,
        osdisk: this.os.disk,
        osload: this.os.loadavg,
        osmem: this.os.mem,
        osup: this.os.uptime,
        psup: this.process.uptime,
        psmem: this.process.memory,
        pscpu: this.process.cpu
    }, callback);
};


/**
* Generate and send Operational Monitoring data
*
* @param {Object} client HTTP client to use for sending
* @param {String} url path to POST data
* @api private
*/
Monitor.prototype._ops = function(client, url) {

    var that = this;
    return function(results) {

        // Note: Anivia-specific schema

        var module = that.options.module || 'Blammo';
        var data = {
            module: module,
            appVer: that.package.version || "0.0.1",
            host: require('os').hostname(),
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

        client.post(url, data, function () { });
    }
};


/**
* Respond to Monitoring Signals and dispatch handlers
*
* @param {String} event signal name
* @api public
*/
Monitor.prototype.handle = function (event) {

    var self = this;

    return function (req, res) {

        if (typeof self.options.monitor[event] !== 'undefined' &&
            self.options.monitor[event] !== null) {

            var hosts = Object.keys(self.options.monitor[event]);
            for (var i in hosts) {

                if (hosts.hasOwnProperty(i)) {
                    var host = hosts[i];
                    var client = self.getClient(host);

                    if (self.options.monitor[event][host]) {

                        self.options.monitor[event][host](client, self)(req, res);
                    }
                    else {

                        try {

                            self['_' + event](client, host, self)(req, res);
                        }
                        catch (e) {

                            throw e;
                        }
                    }
                }
            }
        }
    };
};