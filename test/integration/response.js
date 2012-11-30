// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Hapi = require(libPath + 'hapi');
var NodeUtil = require('util');
var Stream = require('stream');
var Request = require('request');


describe('Response', function () {

    var formatPayload = function (result) {

        if (typeof result === 'string') {
            result += '!!';
        }
        return result;
    };

    var server = new Hapi.Server('0.0.0.0', 17082, { cache: { engine: 'memory' }, format: { payload: formatPayload } });

    var textHandler = function (request) {

        request.reply.payload('text').type('text/plain').bytes(4).ttl(1000).send();
    };

    var errorHandler = function (request) {

        request.reply.payload(new Error('boom')).send();
    };

    var emptyHandler = function (request) {

        request.reply();
    };

    var emptyLongHandler = function (request) {

        request.reply.send();
    };

    var directHandler = function (request) {

        var response = new Hapi.Response.Direct(request)
            .created('me')
            .type('text/plain')
            .bytes(13)
            .ttl(1000)
            .write('!hola ')
            .write('amigos!');

        request.reply(response);
    };

    var fileHandler = function (request) {

        var file = new Hapi.Response.File(__dirname + '/../../package.json');
        request.reply(file);
    };

    var relativeFileHandler = function (request) {

        var file = new Hapi.Response.File('./package.json');
        request.reply(file);
    };

    var fileNotFoundHandler = function (request) {

        var file = new Hapi.Response.File(__dirname + '/../../notHere');
        request.reply(file);
    };

    var fileFnHandler = function (request) {

        return './' + request.params.file;
    };

    var directoryFnHandler = function(request) {

        return './lib/hapi.js';
    };

    var fileFolderHandler = function (request) {

        var file = new Hapi.Response.File(__dirname);
        request.reply(file);
    };

    var expHandler = function (request) {

        Hapi.Response._respond(null, request, function () { });
    };


    FakeStream = function (issue) {

        Stream.call(this);
        this.pause = this.resume = this.setEncoding = function () { };
        this.issue = issue;
        return this;
    };

    NodeUtil.inherits(FakeStream, Stream);


    FakeStream.prototype.on = FakeStream.prototype.addListener = function (event, callback) {

        switch (this.issue) {
            case 'error':
                if (event === 'error') {
                    if (!this.x) {
                        callback();
                        this.x = true;
                    }
                }
                break;

            case 'double':
                if (event === 'data') {
                    callback('x');
                    this.x();
                    this.y();
                }
                else if (event === 'error') {
                    if (!this.x) {
                        this.x = callback;
                    }
                }
                else if (event === 'end') {
                    if (!this.y) {
                        this.y = callback;
                    }
                }
                break;

            default:
                if (event === 'data') {
                    callback('x');
                    this.x();
                }
                else if (event === 'end') {
                    this.x = callback;
                }
                break;
        }
    };

    var streamHandler = function (request) {

        request.reply.stream(new FakeStream(request.params.issue)).bytes(request.params.issue ? 0 : 1).send();
    };

    var cacheHandler = function (request) {

        request.reply({ status: 'cached' });
    };

    server.addRoutes([
        { method: 'GET', path: '/text', config: { handler: textHandler, cache: { mode: 'client', expiresIn: 9999 } } },
        { method: 'GET', path: '/error', handler: errorHandler },
        { method: 'GET', path: '/empty', handler: emptyHandler },
        { method: 'GET', path: '/emptyLong', handler: emptyLongHandler },
        { method: 'GET', path: '/direct', config: { handler: directHandler, cache: { mode: 'client', expiresIn: 9999 } } },
        { method: 'GET', path: '/exp', handler: expHandler },
        { method: 'GET', path: '/stream/{issue?}', handler: streamHandler },
        { method: 'GET', path: '/file', handler: fileHandler },
        { method: 'GET', path: '/relativefile', handler: relativeFileHandler },
        { method: 'GET', path: '/filenotfound', handler: fileNotFoundHandler },
        { method: 'GET', path: '/filefolder', handler: fileFolderHandler },
        { method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../../package.json' } },
        { method: 'GET', path: '/relativestaticfile', handler: { file: './package.json' } },
        { method: 'GET', path: '/filefn/{file}', handler: { file: fileFnHandler } },
        { method: 'GET', path: '/directory/{path*}', handler: { directory: './' } },
        { method: 'GET', path: '/directoryfn', handler: { directory: directoryFnHandler } },
        { method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: './', listing: true } } },
        { method: 'GET', path: '/cache', config: { handler: cacheHandler, cache: { expiresIn: 5000 } } }
    ]);

    it('returns a text reply', function (done) {

        var request = { method: 'GET', url: '/text' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('text!!');
            expect(res.headers['Cache-Control']).to.equal('max-age=1, must-revalidate');
            done();
        });
    });

    it('returns an error reply', function (done) {

        var request = { method: 'GET', url: '/error' };

        server.inject(request, function (res) {

            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist;
            expect(res.result.message).to.equal('boom');
            done();
        });
    });

    it('returns an empty reply', function (done) {

        var request = { method: 'GET', url: '/empty' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('');
            done();
        });
    });

    it('returns an empty reply (long)', function (done) {

        var request = { method: 'GET', url: '/emptyLong' };

        server.inject(request, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal('');
            done();
        });
    });

    it('returns a direct reply', function (done) {

        var request = { method: 'GET', url: '/direct' };

        server.inject(request, function (res) {

            expect(res.statusCode).to.equal(201);
            expect(res.headers.location).to.equal(server.settings.uri + '/me');
            expect(res.readPayload()).to.equal('!hola amigos!');
            done();
        });
    });

    it('returns an error reply on invalid Response._respond', function (done) {

        var request = { method: 'GET', url: '/exp' };

        server.inject(request, function (res) {

            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist;
            expect(res.result.message).to.equal('An internal server error occurred');
            done();
        });
    });

    it('returns a stream reply', function (done) {

        var request = { method: 'GET', url: '/stream' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('x');
            done();
        });
    });

    it('returns a broken stream reply on error issue', function (done) {

        var request = { method: 'GET', url: '/stream/error' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('');
            done();
        });
    });

    it('returns a broken stream reply on double issue', function (done) {

        var request = { method: 'GET', url: '/stream/double' };

        server.inject(request, function (res) {

            expect(res.readPayload()).to.equal('x');
            done();
        });
    });

    it('returns a cached reply', function (done) {

        var request = { method: 'GET', url: '/cache' };

        server.inject(request, function (res1) {

            expect(res1.result).to.exist;
            expect(res1.result.status).to.equal('cached');

            server.inject(request, function (res2) {

                expect(res2.readPayload()).to.equal('{"status":"cached"}');
                done();
            });
        });
    });

    describe('#file', function () {

        it('returns a file in the response with the correct headers', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/file', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a 404 when the file is not found', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/filenotfound', function (err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a 403 when the file is a directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/filefolder', function (err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        it('returns a file using the built-in handler config', function (done) {

            Request.get('http://localhost:17082/staticfile', function (err, res, body) {

                expect(err).to.not.exist;
                expect(body).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the file function handler', function (done) {

            Request.get('http://localhost:17082/filefn/index.js', function (err, res, body) {

                expect(err).to.not.exist;
                expect(body).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/javascript');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        describe('when using a relative path', function() {

            it('returns a file in the response with the correct headers', function (done) {

                server.start(function () {

                    Request.get('http://localhost:17082/relativefile', function (err, res, body) {

                        expect(err).to.not.exist;
                        expect(body).to.contain('hapi');
                        expect(res.headers['content-type']).to.equal('application/json');
                        expect(res.headers['content-length']).to.exist;
                        done();
                    });
                });
            });

            it('returns a file using the built-in handler config', function (done) {

                Request.get('http://localhost:17082/relativestaticfile', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a 304 when the request has a matching etag', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/file', function (err, res1) {

                    var headers = {
                        'if-none-match': res1.headers.etag
                    };

                    Request.get({ url: 'http://localhost:17082/file', headers: headers }, function (err, res2) {

                        expect(res2.statusCode).to.equal(304);
                        done();
                    });
                });
            });
        });

        it('returns a 304 when the request has a future modifed-since', function (done) {

            server.start(function () {

                var date =  new Date(Date.now());
                var headers = {
                    'if-modified-since': new Date(date.setFullYear(date.getFullYear() + 1)).toUTCString()
                };

                Request.get({ url: 'http://localhost:17082/file', headers: headers }, function (err, res) {

                    expect(res.statusCode).to.equal(304);
                    done();
                });
            });
        });

        it('returns a gzipped file in the response when the request accepts gzip', function (done) {

            server.start(function () {

                Request.get({ url: 'http://localhost:17082/file', headers: { 'accept-encoding': 'gzip' } }, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-encoding']).to.equal('gzip');
                    expect(res.headers['content-length']).to.not.exist;
                    expect(body).to.exist;
                    done();
                });
            });
        });
    });

    describe('#directory', function () {

        it('returns a 404 when no index exists and listing is disabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/directory', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a file when requesting a file from the directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/directory/package.json', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('hapi');
                    done();
                });
            });
        });

        it('returns the correct file when requesting a file from a child directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/directory/test/integration/response.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('http://localhost:17082/directory//test/integration/response.js');
                    done();
                });
            });
        });

        it('returns a list of files when listing is enabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/directorylist', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        it('returns the correct file when using a fn directory handler', function (done) {

            server.start(function () {

                Request.get('http://localhost:17082/directoryfn', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('export');
                    done();
                });
            });
        });
    });
});