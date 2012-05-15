/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Async = require('async');
var Client = require('../client');
var Utils = require('../utils');
var OsMonitor = require('./os');
var ProcessMonitor = require('./process');

// Declare internals

var internals = {};


// Monitor constructor

module.exports = Monitor = function (server) {

    this.server = server.listener;
    this.options = Utils.merge({}, server.settings || {});

    // Load process level functions

    this.process = new ProcessMonitor();

    // Load OS level functions

    this.os = new OsMonitor();

    // Public properties

    this.clients = {};
    this.timer = null;

    return this;
};


Monitor.prototype.getClient = function (host) {

    if (this.clients.hasOwnProperty(host)) {

        return this.clients[host];
    }
    else {

        this.clients[host] = new Client({ host: host });
        return this.clients[host];
    }
};


Monitor.prototype.logger = function () {

    var self = this;

    if (this.server) {

        this.server.removeListener('response', this.handle('request'));
        this.server.on('response', this.handle('request'));
    }

    if (this.options.monitor.interval && Object.keys(this.options.monitor.ops).length > 0) {

        clearInterval(this.timer);
        this.timer = setInterval((function (s) {

            return function () {

                return s.meter();
            };
        })(self), this.options.monitor.interval);
    }

    return this.process.instrument;
};


Monitor.prototype.meter = function () {

    var event = 'ops';
    // TODO: factor out into shared fn
    var hosts = Object.keys(this.options.monitor[event]);

    for (var i in hosts) {

        if (hosts.hasOwnProperty(i)) {

            var host = hosts[i];
            var client = this.getClient(host);
            // console.log(this.os.poll_cpu.toString());
            this.options.monitor[event][host](client, this)();
        }
    }
};


Monitor.prototype._request = function (client, url, monitor) {

    return function (req, res) {

        var modified_headers = Utils.clone(req.headers);

        delete modified_headers['host'];
        delete modified_headers['connection'];
        modified_headers['remote-address'] = req.connection.remoteAddress;

        client.post(url, {

            module: 'Blammo',
            host: require('os').hostname(),
            events: [
                {
                    event: 'request',
                    headers: modified_headers,
                    responseTime: new Date - req._startTime,
                    responseSize: res._headers['content-length'],
                    ets: new Date().getTime()
                }
            ]
        }, function (err, res, body) { });
    };
};

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
    }, function (err, results) {

        callback(err, results);
    });
};

Monitor.prototype._ops = function(client, url, monitor) {

    return function(results) {

        var data = {
            module: that.options.settings.module || 'Blammo',
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

            data.message.events[0].properties.os.cpu = results.oscpu;
        }

        client.post(url, data, function () { });
    }
};

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

