// Load modules

var Lab = require('lab');
var DTraceProvider = require('dtrace-provider');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('DTrace', function () {

    it('fires pre start and end probes when a request is made with prerequisites', function (done) {

        var provider = DTraceProvider.DTraceProvider;
        var probe = {
            fire: function (fn) {

                expect(fn()).to.contain('m1');
                DTraceProvider.DTraceProvider = provider;
                done();
            }
        };

        DTraceProvider.DTraceProvider = function () {

            return {
                addProbe: function (key) {

                    return probe;
                },
                enable: function () {}
            };
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

        });
    });
});
