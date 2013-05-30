// Load modules

var Lab = require('lab');
var Shot = require('shot');
var Hapi = require('../..');
var Payload = require('../../lib/payload');
var Route = require('../../lib/route');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Payload', function () {

    var server = new Hapi.Server({ payload: { maxBytes: 48 } });

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

        it('passes null to the callback when the method is not put, patch or post', function (done) {
            var request = {
                _timestamp: Date.now(),
                method: 'delete',
                _route: new Route({ method: '*', path: '/', handler: function () { } }, server),
                raw: {
                    req: {
                        read: function () { }
                    }
                }
            };

            request.route = request._route.settings;

            Payload.read(request, function (result) {

                expect(result).not.to.exist;
                done();
            });
        });

        it('sets the request payload property whenever reading a json request', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/json' }, '{ "item": "test" }', function (req, res) {

                var request = {
                    _timestamp: Date.now(),
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                    raw: {
                        req: req
                    },
                    server: server
                };

                request.route = request._route.settings;

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
                    _timestamp: Date.now(),
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                    raw: {
                        req: req
                    },
                    server: server
                };

                request.route = request._route.settings;

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
                    _timestamp: Date.now(),
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                    raw: {
                        req: req
                    },
                    server: server
                };

                request.route = request._route.settings;

                Payload.read(request, function (err) {

                    expect(err).to.not.exist;
                    expect(request.payload.item).to.equal('test');
                    done();
                });
            });
        });

        it('passes an Error to the callback whenever reading a payload too big (no header)', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/json' }, '{ "key":"12345678901234567890123456789012345678901234567890" }', function (req, res) {

                var request = {
                    _timestamp: Date.now(),
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                    raw: {
                        req: req
                    },
                    server: server
                };

                request.route = request._route.settings;

                Payload.read(request, function (err) {

                    expect(err).to.exist;
                    expect(request.payload).to.be.empty;
                    expect(err).to.be.an.instanceOf(Error);
                    done();
                });
            });
        });

        it('passes an Error to the callback whenever reading a payload too big (header)', function (done) {

            shotRequest('POST', '/', { 'content-type': 'application/json', 'content-length': 62 }, '{ "key":"12345678901234567890123456789012345678901234567890" }', function (req, res) {

                var request = {
                    _timestamp: Date.now(),
                    method: 'post',
                    _route: new Route({ method: 'post', path: '/', handler: function () { } }, server),
                    raw: {
                        req: req
                    },
                    server: server
                };

                request.route = request._route.settings;

                Payload.read(request, function (err) {

                    expect(err).to.exist;
                    expect(request.payload).to.be.empty;
                    expect(err).to.be.an.instanceOf(Error);
                    done();
                });
            });
        });
    });
});