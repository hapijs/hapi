// Load modules

var Path = require('path');
var Stream = require('stream');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Response Range', function () {

    it('returns a subset of a file (start)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(5);
            expect(res.headers['content-range']).to.equal('bytes 0-4/42010');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('\x89PNG\r');
            done();
        });
    });

    it('returns a subset of a file (middle)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=1-5' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(5);
            expect(res.headers['content-range']).to.equal('bytes 1-5/42010');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('PNG\r\n');
            done();
        });
    });

    it('returns a subset of a file (-to)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=-5' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(5);
            expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('D\xAEB\x60\x82');
            done();
        });
    });

    it('returns a subset of a file (from-)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=42005-' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(5);
            expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('D\xAEB\x60\x82');
            done();
        });
    });

    it('returns a subset of a file (beyond end)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(5);
            expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('D\xAEB\x60\x82');
            done();
        });
    });

    it('returns a subset of a file (if-range)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject('/file', function (res) {

            server.inject('/file', function (res1) {

                server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': res1.headers.etag } }, function (res2) {

                    expect(res2.statusCode).to.equal(206);
                    expect(res2.headers['content-length']).to.equal(5);
                    expect(res2.headers['content-range']).to.equal('bytes 42005-42009/42010');
                    expect(res2.headers['accept-ranges']).to.equal('bytes');
                    expect(res2.payload).to.equal('D\xAEB\x60\x82');
                    done();
                });
            });
        });
    });

    it('returns 200 on incorrect if-range', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': 'abc' } }, function (res2) {

            expect(res2.statusCode).to.equal(200);
            done();
        });
    });

    it('returns 416 on invalid range (unit)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'horses=1-5' } }, function (res) {

            expect(res.statusCode).to.equal(416);
            expect(res.headers['content-range']).to.equal('bytes */42010');
            done();
        });
    });

    it('returns 416 on invalid range (inversed)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=5-1' } }, function (res) {

            expect(res.statusCode).to.equal(416);
            expect(res.headers['content-range']).to.equal('bytes */42010');
            done();
        });
    });

    it('returns 416 on invalid range (format)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes 1-5' } }, function (res) {

            expect(res.statusCode).to.equal(416);
            expect(res.headers['content-range']).to.equal('bytes */42010');
            done();
        });
    });

    it('returns 416 on invalid range (empty range)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=-' } }, function (res) {

            expect(res.statusCode).to.equal(416);
            expect(res.headers['content-range']).to.equal('bytes */42010');
            done();
        });
    });

    it('returns 200 on multiple ranges', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/file', handler: { file: { path: Path.join(__dirname, 'file/image.png') } } });

        server.inject({ url: '/file', headers: { 'range': 'bytes=1-5,7-10' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(42010);
            done();
        });
    });

    it('returns a subset of a stream', function (done) {

        var TestStream = function () {

            Stream.Readable.call(this);
            this._count = -1;
        };

        Hoek.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            this._count++;

            if (this._count > 10) {
                return;
            }

            if (this._count === 10) {
                this.push(null);
                return;
            }

            this.push(this._count.toString());
        };

        TestStream.prototype.size = function () {

            return 10;
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(new TestStream()); } });

        server.inject({ url: '/', headers: { 'range': 'bytes=2-4' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(3);
            expect(res.headers['content-range']).to.equal('bytes 2-4/10');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('234');
            done();
        });
    });

    it('returns a consolidated range', function (done) {

        var TestStream = function () {

            Stream.Readable.call(this);
            this._count = -1;
        };

        Hoek.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            this._count++;

            if (this._count > 10) {
                return;
            }

            if (this._count === 10) {
                this.push(null);
                return;
            }

            this.push(this._count.toString());
        };

        TestStream.prototype.size = function () {

            return 10;
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(new TestStream()); } });

        server.inject({ url: '/', headers: { 'range': 'bytes=0-1,1-2, 3-5' } }, function (res) {

            expect(res.statusCode).to.equal(206);
            expect(res.headers['content-length']).to.equal(6);
            expect(res.headers['content-range']).to.equal('bytes 0-5/10');
            expect(res.headers['accept-ranges']).to.equal('bytes');
            expect(res.payload).to.equal('012345');
            done();
        });
    });
});
