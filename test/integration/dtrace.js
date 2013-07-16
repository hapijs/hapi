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
});
