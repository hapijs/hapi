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

    it('doesn\'t fire probes when dtrace provider isn\'t installed', function (done) {

        var provider = DTrace.Provider;
        var isInstalled = DTrace.isInstalled;
        DTrace.Provider = function () {

            return {
                enable: function () {},
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


        var pre1 = function (request, next) {

            next('Hello');
        };

        server.route({ method: '*', path: '/', config: {
            handler: function () {

                this.reply('OK');
            },
            pre: [
                { method: pre1, assign: 'm1' }
            ]
        }});

        server.inject({ url: '/' }, function () {

            DTrace.Provider = provider;
            DTrace.isInstalled = isInstalled;
            done();
        });
    });

    it('fires correct probe on prerequisites when dtrace-provider is installed', function (done) {

        var provider = DTrace.Provider;
        var isInstalled = DTrace.isInstalled;
        DTrace.Provider = function () {

            return {
                enable: function () {},
                addProbe: function () {

                    return {
                        fire: function (fn) {

                            expect(fn()).to.contain('m1');
                            DTrace.Provider = provider;
                            DTrace.isInstalled = isInstalled;
                            done();
                        }
                    };
                }
            };
        };
        DTrace.isInstalled = function () {

            return true;
        };

        var server = new Hapi.Server();
        var pre1 = function (request, next) {

            next('Hello');
        };

        server.route({ method: '*', path: '/', config: {
            handler: function () {

                this.reply('OK');
            },
            pre: [
                { method: pre1, assign: 'm1' }
            ]
        }});

        server.inject({ url: '/' }, function () {});
    });

    it('allows probes to be added dynamically', function (done) {

        var runNum = 0;
        var provider = DTrace.Provider;
        DTrace.Provider = function () {

            return {
                enable: function () {},
                addProbe: function () {

                    return {
                        fire: function (fn) {

                            if (runNum++ === 0) {
                                expect(fn()).to.contain(20);
                                expect(fn()).to.contain('some value');
                            }
                            else {
                                expect(fn()).to.contain(1);
                                expect(fn()).to.contain('3');
                            }
                        }
                    };
                }
            };
        };
        var server = new Hapi.Server();

        server.route({ method: '*', path: '/', config: {
            handler: function () {

                this.server._dtrace.report('my.handler.start', 20, 'some value');
                this.reply('OK');
                this.server._dtrace.report('my.handler.end', 1, '3');
            }
        }});

        server.inject({ url: '/' }, function () {
            DTrace.Provider = provider;
            done();
        });
    });

    it('probes add the correct data types', function (done) {

        var provider = DTrace.Provider;
        DTrace.Provider = function () {

            return {
                enable: function () {},
                addProbe: function (key, val1, val2, val3) {

                    expect(key).to.equal('my.probe');
                    expect(val1).to.equal('int');
                    expect(val2).to.equal('char *');
                    expect(val3).to.equal('json');
                    DTrace.Provider = provider;
                    done();

                    return {
                        fire: function () {}
                    };
                }
            };
        };
        var server = new Hapi.Server();
        server._dtrace.report('my.probe', 20, 'some value', { some: 'obj' });
    });

    it('allows probes to be added dynamically with the dtrace-provider installed', function (done) {

        var server = new Hapi.Server();

        server.route({ method: '*', path: '/', config: {
            handler: function () {

                this.server._dtrace.report('my.handler.start', 20, ['some value', 1]);
                this.reply('OK');
                this.server._dtrace.report('my.handler.end', 1, '3');
            }
        }});

        server.inject({ url: '/' }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });
});
