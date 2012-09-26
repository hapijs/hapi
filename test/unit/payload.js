// Load modules

var expect = require('chai').expect;
var Payload = process.env.TEST_COV ? require('../../lib-cov/payload') : require('../../lib/payload');
var ServerMock = require('./mocks/server');
var NodeUtil = require('util');
var Events = require('events');


describe('Payload', function() {

    describe('#read', function() {

        it('passes null to the callback when the request is a GET', function(done) {
            var request = {
                method: 'get'
            };

            Payload.read(request, function(result) {
                expect(result).not.to.exist;
                done();
            });
        });

        it('passes null to the callback when the method is not put or post', function(done) {
            var request = {
                method: 'delete',
                _route: {
                    config: {}
                }
            };

            Payload.read(request, function(result) {
                expect(result).not.to.exist;
                done();
            });
        });

        it('passes an error to the callback whenever an unsupported mime type is read', function(done) {
             var request = {
                 method: 'post',
                 _route: {
                     config: {}
                 },
                 raw: {
                     req: {
                         headers: {
                             'content-type': 'blah'
                         }
                     }
                 }
             };

             Payload.read(request, function(err) {
                expect(err).to.be.an.instanceOf(Error);
                 done();
             });
        });

        it('passes a parsed object to the callback whenever reading a json request', function(done) {
            function clientRequest() {
                Events.EventEmitter.call(this);
            }

            NodeUtil.inherits(clientRequest, Events.EventEmitter);

            var req = new clientRequest();
            req.headers = {
                'content-type': 'application/json'
            };

            req.setEncoding = function() { };

            var request = {
                method: 'post',
                _route: {
                    config: {}
                },
                raw: {
                    req: req
                },
                server: ServerMock
            };

            Payload.read(request, function(err) {
                expect(err).to.not.exist;
                expect(request.payload.item).to.equal('test');
                done();
            });

            req.emit('data', '{ "item": "test" }');
            req.emit('end');
        });
    });
});