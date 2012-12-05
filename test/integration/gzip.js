// Load modules

var Chai = require('chai');
var Zlib = require('zlib');
var Request = require('request');
var Hapi = process.env.TEST_COV ? require('../../lib-cov') : require('../../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Payload', function () {

    var server = new Hapi.Server('0.0.0.0', 17080);
    var message = { 'msg': 'This message is going to be gzipped.' };
    var badMessage = '{ this is just wrong }';

    var postHandler = {
        method: 'POST',
        path: '/',
        config: {
            handler: function (req) {

                req.reply(req.payload);
            }
        }
    };

    server.addRoute(postHandler);

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
                expect(res.result.message).to.equal('Invalid request payload format');
                done();
            });
        });
    });

    it('returns a gzip response when accept-encoding: gzip is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            server.start(function () {

                Request.post({ url: 'http://localhost:17080', headers: { 'accept-encoding': 'gzip' }, body: rawBody }, function (err, res, body) {

                    expect(body).to.equal(zippedBody.toString());
                    done();
                });
            });
        });
    });

    it('returns a gzip response when accept-encoding: deflate,gzip is requested', function (done) {

        var rawBody = '{"test":"true"}';

        Zlib.gzip(new Buffer(rawBody), function (err, zippedBody) {

            server.start(function () {

                Request.post({ url: 'http://localhost:17080', headers: { 'accept-encoding': 'deflate, gzip' }, body: rawBody }, function (err, res, body) {

                    expect(body).to.equal(zippedBody.toString());
                    done();
                });
            });
        });
    });
});