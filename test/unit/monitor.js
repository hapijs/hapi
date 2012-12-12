// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Monitor', function () {

    it('uses the passed in broadcastInterval and sets the event queue correctly', function (done) {

        var subscribers = {
            console: ['request', 'log'],
            'http://localhost/logs': ['log']
        };

        var settings = {
            monitor: {
                opsInterval: 200,
                subscribers: subscribers,
                requestsEvent: 'response',
                broadcastInterval: 5
            }
        };

        var monitor = new Hapi.server(settings)._monitor;

        expect(monitor._subscriberQueues.console).to.exist;
        expect(monitor._eventQueues.request).to.exist;
        expect(monitor._eventQueues.log).to.exist;
        done();
    });

    describe('#_ops', function () {

        it('sets the event with the result data correctly', function (done) {

            var results = {
                osload: 1,
                osmem: 20,
                osdisk: 30,
                osup: 50
            };

            var subscribers = {
                console: ['ops']
            };

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var monitor = new Hapi.server(settings)._monitor;

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.ops).to.exist;

            var ops = monitor._ops();
            var event = ops(results);

            expect(event.os.load).to.equal(1);
            expect(event.os.mem).to.equal(20);
            expect(event.os.disk).to.equal(30);
            done();
        });
    });

    describe('#_initOps', function () {

        it('emits an ops event when everything succeeds', function (done) {

            var subscribers = {
                console: ['ops']
            };

            var settings = {
                monitor: {
                    opsInterval: 100,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Hapi.server('0.0.0.0', 19999, settings);

            server._monitor._initOps();
            server.removeAllListeners('ops');

            server.once('ops', function (event) {

                expect(event.osdisk.total).to.equal(100);
                expect(event.osup).to.equal(1000);
                done();
            });

            server._monitor._os = {
                cpu: function (cb) {

                    cb(null, 1);
                },
                disk: function (cb) {

                    cb(null, { total: 100, free: 10 });
                },
                loadavg: function (cb) {

                    cb();
                },
                mem: function (cb) {

                    cb();
                },
                uptime: function (cb) {

                    cb(null, 1000);
                }
            };
            server._monitor._process = {
                uptime: function (cb) {

                    cb(null, 1000);
                },
                memory: function (cb) {

                    cb();
                },
                cpu: function (cb) {

                    cb();
                }
            };
        });

        it('logs errors when they occur', function (done) {

            var subscribers = {
                console: ['ops']
            };

            var settings = {
                monitor: {
                    opsInterval: 100,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Hapi.server('0.0.0.0', 19999, settings);

            server._monitor._initOps();
            server.removeAllListeners('ops');

            server._monitor._os = {
                cpu: function (cb) {

                    cb(new Error(), 1);
                },
                disk: function (cb) {

                    cb(null, { total: 100, free: 10 });
                },
                loadavg: function (cb) {

                    cb();
                },
                mem: function (cb) {

                    cb();
                },
                uptime: function (cb) {

                    cb(null, 1000);
                }
            };
            server._monitor._process = {
                uptime: function (cb) {

                    cb(null, 1000);
                },
                memory: function (cb) {

                    cb();
                },
                cpu: function (cb) {

                    cb();
                }
            };

            done();
        });
    });

    describe('#_display', function () {

        it('prints to the log event data for ops events', function (done) {

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: {
                        console: ['ops']
                    },
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var monitor = new Hapi.server(settings)._monitor;

            var data = {
                events: [{
                    event: 'ops',
                    proc: {
                        mem: {
                            rss: 1
                        },
                        cpu: 10
                    }
                }]
            };

            Hapi._TEST.once('log', function (message) {

                expect(message).to.contain('memory');
                done();
            });

            monitor._display(data);
        });

        it('prints to the log event data for request events', function (done) {

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: {
                        console: ['ops']
                    },
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var monitor = new Hapi.server(settings)._monitor;

            var data = {
                events: [{
                    event: 'request',
                    instance: 'testInstance',
                    method: 'testMethod'
                }]
            };

            Hapi._TEST.once('log', function (message) {

                expect(message).to.contain('testMethod');
                done();
            });

            monitor._display(data);
        });
    });
});
