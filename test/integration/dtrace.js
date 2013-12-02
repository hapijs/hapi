// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var DTrace = require('../../lib/dtrace');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('DTrace', function () {

    it('does not fire probes when dtrace provider isn\'t installed', function (done) {

        var isInstalled = DTrace.isInstalled;
        var provider = function () {

            return {
                enable: function () {},
                disable: function () {},
                addProbe: function () {

                    return {
                        fire: function (fn) {

                            expect(fn).to.not.exist;
                        }
                    };
                }
            };
        };
        DTrace.isInstalled = function () {

            return false;
        };

        var server = new Hapi.Server();
        server._dtrace._provider = provider;

        var pre1 = function (request, next) {

            next('Hello');
        };

        server.route({ method: '*', path: '/', config: {
            handler: function (request, reply) {

                reply('OK');
            },
            pre: [
                { method: pre1, assign: 'm1' }
            ]
        }});

        server.inject({ url: '/' }, function () {

            DTrace.isInstalled = isInstalled;
            done();
        });
    });

    it('fires correct probe on prerequisites when dtrace-provider is installed', function (done) {

        var results = [];
        var provider = {
            enable: function () {},
            disable: function () {},
            addProbe: function () {

                return {
                    fire: function (fn) {

                        results = results.concat(fn());
                    }
                };
            }
        };

        var server = new Hapi.Server();
        server._dtrace._provider = provider;
        var pre1 = function (request, next) {

            next('Hello');
        };

        server.route({ method: '*', path: '/', config: {
            handler: function (request, reply) {

                reply('OK');
            },
            pre: [
                { method: pre1, assign: 'm1' }
            ]
        }});

        server.inject({ url: '/' }, function () {

            expect(results).to.contain('m1');
            done();
        });
    });

    it('allows probes to be added dynamically', function (done) {

        var results = [];
        var provider =  {
            enable: function () {},
            disable: function () {},
            addProbe: function () {

                return {
                    fire: function (fn) {

                        results = results.concat(fn());
                    }
                };
            }
        };
        var server = new Hapi.Server();
        server._dtrace._provider = provider;

        server.route({ method: '*', path: '/', config: {
            handler: function (request, reply) {

                request.server._dtrace.report('my.handler.start', 20, 'some value');
                reply('OK');
                request.server._dtrace.report('my.handler.end', 1, '3');
            }
        }});

        server.inject({ url: '/' }, function () {

            expect(results).to.contain(20);
            expect(results).to.contain('some value');
            expect(results).to.contain(1);
            expect(results).to.contain('3');
            done();
        });
    });

    it('probes add the correct data types', function (done) {

        var provider =  {
            enable: function () {},
            disable: function () {},
            addProbe: function (key, val1, val2, val3) {

                expect(key).to.equal('my.probe');
                expect(val1).to.equal('int');
                expect(val2).to.equal('char *');
                expect(val3).to.equal('json');
                done();

                return {
                    fire: function () {}
                };
            }
        };
        var server = new Hapi.Server();
        server._dtrace._provider = provider;
        server._dtrace.report('my.probe', 20, 'some value', { some: 'obj' });
    });

    it('allows probes to be added dynamically with the dtrace-provider installed', function (done) {

        var server = new Hapi.Server();

        server.route({ method: '*', path: '/', config: {
            handler: function (request, reply) {

                request.server._dtrace.report('my.handler.start', 20, ['some value', 1]);
                reply('OK');
                request.server._dtrace.report('my.handler.end', 1, '3');
            }
        }});

        server.inject({ url: '/' }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });
});
