// Load modules

var expect = require('chai').expect;
var Payload = process.env.TEST_COV ? require('../../lib-cov/payload') : require('../../lib/payload');
var Route = process.env.TEST_COV ? require('../../lib-cov/route') : require('../../lib/route');
var Server = process.env.TEST_COV ? require('../../lib-cov/server') : require('../../lib/server');
var ServerMock = require('./mocks/server');
var NodeUtil = require('util');
var Events = require('events');
var Shot = require('shot');


describe('Payload', function () {

    var server = new Server();

    var shotRequest = function (method, path, headers, payload, callback) {

        var reqOptions = {
            url: path,
            method: method,
            headers: headers,
            payload: payload
        };
        Shot.inject(callback, reqOptions, function () { });
    };

    describe('#read', function () {

        it('passes null to the callback when the request is a GET', function (done) {

            var request = {
                method: 'get',
                raw: {
                    req: {
                        resume: function () { }
                    }
                }
            };

            Payload.read(request, function (result) {
                expect(result).not.to.exist;
                done();
            });
        });

        it('passes null to the callback when the method is not put or post', function (done) {
            var request = {
                method: 'delete',
                _route: new Route({ method: 'delete', path: '/', handler: function () { } }, server),
                raw: {
                    req: {
                        resume: function () { }
                    }
                }
            };

            Payload.read(request, function (result) {
                expect(result).not.to.exist;
                done();
            });
        });

        it('passes an error to the callback whenever an unsupported mime type is read', function (done) {
            var request = {
                method: 'post',
                _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                raw: {
                    req: {
                        headers: {
                            'content-type': 'blah'
                        }
                    }
                }
            };

            Payload.read(request, function (err) {
                expect(err).to.be.an.instanceOf(Error);
                done();
            });
        });

        it('sets the request payload property whenever reading a json request', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/json' }, '{ "item": "test" }', function (req, res) {

                var request = {
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, ServerMock),
                    raw: {
                        req: req
                    },
                    server: ServerMock
                };

                Payload.read(request, function (err) {
                    expect(err).to.not.exist;
                    expect(request.payload.item).to.equal('test');
                    done();
                });
            });
        });

        it('passes an Error to the callback whenever reading an invalid json request', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/json' }, '{ this is just wrong }', function (req, res) {

                var request = {
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, ServerMock),
                    raw: {
                        req: req
                    },
                    server: ServerMock
                };

                Payload.read(request, function (err) {
                    expect(err).to.exist;
                    expect(request.payload).to.be.empty;
                    expect(err).to.be.an.instanceOf(Error);
                    done();
                });
            });
        });

        it('sets the request payload property whenever reading a form request', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/x-www-form-urlencoded' }, 'item=test', function (req, res) {

                var request = {
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, ServerMock),
                    raw: {
                        req: req
                    },
                    server: ServerMock
                };

                Payload.read(request, function (err) {
                    expect(err).to.not.exist;
                    expect(request.payload.item).to.equal('test');
                    done();
                });
            });
        });

        /*    it('passes an Error to the callback whenever reading an invalid form request', function(done) {
                function clientRequest() {
                    Events.EventEmitter.call(this);
                }
    
                NodeUtil.inherits(clientRequest, Events.EventEmitter);
    
                var req = new clientRequest();
                req.headers = {
                    'content-type': 'application/x-www-form-urlencoded'
                };
    
                req.setEncoding = function() { };
    
                var request = {
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function (){} }, {}),
                    raw: {
                        req: req
                    },
                    server: ServerMock
                };
    
                Payload.read(request, function(err) {
                    expect(err).to.exist;
                    expect(request.payload).to.be.empty;
                    expect(err).to.be.an.instanceOf(Error);
                    done();
                });
    
                req.emit('data', '\u777F');
                req.emit('end');
            });*/
    });
});