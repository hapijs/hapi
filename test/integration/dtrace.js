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

    it('fires pre start and end probes when a request is made with prerequisites', function (done) {

        var provider = DTrace.Provider;
        DTrace.Provider = function () {

            return {
                enable: function () {},
                addProbe: function () {

                    return {
                        fire: function (fn) {

                            DTrace.Provider = provider;
                            expect(fn()).to.contain('m1');
                            done();
                        }
                    };
                }
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
