// Load modules

var Lab = require('lab');
var Zlib = require('zlib');
var Nipple = require('nipple');
var Hapi = require('..');


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
    var data = '{"test":"true"}';
    var zdata = null;
    var ddata = null;

    var postHandler = {
        method: 'POST',
        path: '/',
        handler: function (request, reply) {

            reply(request.payload);
        }
    };

    server.route(postHandler);

    var getHandler = {
        method: 'GET',
        path: '/',
        handler: function (request, reply) {

            reply(data);
        }
    };

    server.route(getHandler);

    before(function (done) {

        server.start(function () {

            uri = 'http://localhost:' + server.info.port;

            Zlib.gzip(new Buffer(data), function (err, zipped) {

                zdata = zipped.toString();

                Zlib.deflate(new Buffer(data), function (err, deflated) {

                    ddata = deflated.toString();
                    done();
                });
            });
        });
    });

    it('returns without error if given gzipped payload', function (done) {

        var input = JSON.stringify(message);

        Zlib.gzip(input, function (err, buf) {

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

    it('returns error if given wrong encoding', function (done) {

        var input = JSON.stringify(message);

        Zlib.gzip(input, function (err, buf) {

            var request = {
                method: 'POST',
                url: '/',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'deflate',
                    'content-length': buf.length
                },
                payload: buf
            };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(400);
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

    it('returns a gzip response on a post request when accept-encoding: gzip is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a gzip response on a get request when accept-encoding: gzip is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': 'gzip' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a gzip response on a post request when accept-encoding: * is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': '*' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a gzip response on a get request when accept-encoding: * is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': '*' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a deflate response on a post request when accept-encoding: deflate is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': 'deflate' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(ddata);
            done();
        });
    });

    it('returns a deflate response on a get request when accept-encoding: deflate is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': 'deflate' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(ddata);
            done();
        });
    });

    it('returns a gzip response on a post request when accept-encoding: gzip,q=1; deflate,q=.5 is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': 'gzip,q=1; deflate,q=.5' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a gzip response on a get request when accept-encoding: gzip,q=1; deflate,q=.5 is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': 'gzip,q=1; deflate,q=.5' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a deflate response on a post request when accept-encoding: deflate,q=1; gzip,q=.5 is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': 'deflate,q=1; gzip,q=.5' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(ddata);
            done();
        });
    });

    it('returns a deflate response on a get request when accept-encoding: deflate,q=1; gzip,q=.5 is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': 'deflate,q=1; gzip,q=.5' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(ddata);
            done();
        });
    });

    it('returns a gzip response on a post request when accept-encoding: deflate, gzip is requested', function (done) {

        Nipple.post(uri, { headers: { 'accept-encoding': 'deflate, gzip' }, payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns a gzip response on a get request when accept-encoding: deflate, gzip is requested', function (done) {

        Nipple.get(uri, { headers: { 'accept-encoding': 'deflate, gzip' } }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(zdata);
            done();
        });
    });

    it('returns an identity response on a post request when accept-encoding is missing', function (done) {

        Nipple.post(uri, { payload: data }, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body).to.equal(data);
            done();
        });
    });

    it('returns an identity response on a get request when accept-encoding is missing', function (done) {

        Nipple.get(uri, {}, function (err, res, body) {

            expect(err).to.not.exist;
            expect(body.toString()).to.equal(data);
            done();
        });
    });
});