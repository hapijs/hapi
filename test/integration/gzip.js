// Load modules

var Lab = require('lab');
var Zlib = require('zlib');
var Request = require('request');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Payload', function () {

    var server = new Hapi.Server('0.0.0.0', 0);
    var uri = '';
    var message = { 'msg': 'This message is going to be gzipped.' };
    var badMessage = '{ gzip this is just wrong }';

    var postHandler = {
        method: 'POST',
        path: '/',
        config: {
            handler: function (req) {

                req.reply(req.payload);
            }
        }
    };

    server.route(postHandler);

    before(function (done) {

        server.start(function () {

            uri = 'http://localhost:' + server.info.port;
            done();
        });
    });

    it('returns without error if given gzipped payload', function (done) {

        var input = JSON.stringify(message);

        Zlib.deflate(input, function (err, buf) {

            var request = {
                method: 'POST',
                url: '/',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'gzip',
                    'content-length': buf.length
                },
                payload: buf
            };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.deep.equal(message);
                done();
            });
        });
    });

    it('returns without error if given non-gzipped payload', function (done) {

        var payload = JSON.stringify(message);

        var request = {
            method: 'POST',
            url: '/',
            headers: {
                'content-type': 'application/json',
                'content-length': payload.length
            },
            payload: payload
        };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.deep.equal(message);
            done();
        });
    });

    it('returns error if given non-JSON gzipped payload when expecting gzip', function (done) {

        Zlib.deflate(badMessage, function (err, buf) {

            var request = {
                method: 'POST',
                url: '/',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'gzip',
                    'content-length': buf.length
                },
                payload: buf
            };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.message).to.exist;
                done();
            });
        });
    });

    it('returns a gzip response when accept-encoding: gzip is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': 'gzip' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns a gzip response when accept-encoding: * is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': '*' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns a deflate response when accept-encoding: deflate is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.deflate(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': 'deflate' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns a gzip response when accept-encoding: gzip,q=1; deflate,q=.5 is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': 'gzip,q=1; deflate,q=.5' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns a deflate response when accept-encoding: deflate,q=1; gzip,q=.5 is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.deflate(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': 'deflate,q=1; gzip,q=.5' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns a gzip response when accept-encoding: deflate, gzip is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            Request.post({ url: uri, headers: { 'accept-encoding': 'deflate, gzip' }, body: rawBody }, function (err, res, body) {

                expect(body).to.equal(zippedBody.toString());
                done();
            });
        });
    });

    it('returns an identity response when accept-encoding is missing', function (done) {

        var rawBody = '{"test":"true"}';

        Request.post({ url: uri, headers: {}, body: rawBody }, function (err, res, body) {

            expect(body).to.equal(rawBody);
            done();
        });
    });
});