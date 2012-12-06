// Load modules

var Chai = require('chai');
var NodeUtil = require('util');
var Stream = require('stream');
var Request = require('request');
var Hapi = process.env.TEST_COV ? require('../../lib-cov') : require('../../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('Text', function () {

        it('returns a text reply', function (done) {

            var handler = function (request) {

                request.reply.payload('text').type('text/plain').bytes(4).ttl(1000).send();
            };

            var server = new Hapi.Server({ cache: { engine: 'memory' } });
            server.addRoute({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('text');
                expect(res.headers['Cache-Control']).to.equal('max-age=1, must-revalidate');
                done();
            });
        });
    });

    describe('Error', function () {

        it('returns an error reply', function (done) {

            var handler = function (request) {

                request.reply.payload(new Error('boom')).send();
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('boom');
                done();
            });
        });
    });

    describe('Empty', function () {

        var handler = function (request) {

            if (request.query.x) {
                return request.reply.send();
            }

            return request.reply();
        };

        var server = new Hapi.Server();
        server.addRoutes([
            { method: 'GET', path: '/', handler: handler },
        ]);

        it('returns an empty reply', function (done) {

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('');
                done();
            });
        });

        it('returns an empty reply (long form)', function (done) {

            server.inject({ method: 'GET', url: '/?x=1' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('');
                done();
            });
        });
    });

    describe('Direct', function () {

        it('returns a direct reply', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Direct(request)
                    .created('me')
                    .type('text/plain')
                    .bytes(13)
                    .ttl(1000)
                    .write('!hola ')
                    .write('amigos!');

                request.reply(response);
            };

            var server = new Hapi.Server({ cache: { engine: 'memory' } });
            server.addRoute({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal(server.settings.uri + '/me');
                expect(res.readPayload()).to.equal('!hola amigos!');
                done();
            });
        });
    });

    describe('File', function () {

        var server = new Hapi.Server(17082);

        it('returns a file in the response with the correct headers', function (done) {

            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.addRoute({ method: 'GET', path: '/file', handler: handler });

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

        it('returns a file in the response with the correct headers using process relative paths', function (done) {

            var server = new Hapi.Server(17084, { files: { relativeTo: 'process' } });
            server.addRoute({ method: 'GET', path: '/', handler: { file: './package.json' } });

            server.start(function () {

                Request.get('http://localhost:17084/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a 404 when the file is not found', function (done) {

            var notFoundHandler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../notHere'));
            };

            server.addRoute({ method: 'GET', path: '/filenotfound', handler: notFoundHandler });

            server.start(function () {

                Request.get('http://localhost:17082/filenotfound', function (err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a 403 when the file is a directory', function (done) {

            var folderHandler = function (request) {

                request.reply(new Hapi.Response.File(__dirname));
            };

            server.addRoute({ method: 'GET', path: '/filefolder', handler: folderHandler });

            server.start(function () {

                Request.get('http://localhost:17082/filefolder', function (err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        var filenameFn = function (request) {

            return '../../' + request.params.file;
        };

        it('returns a file using the build-in handler config', function (done) {

            server.addRoute({ method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../../package.json' } });

            Request.get('http://localhost:17082/staticfile', function (err, res, body) {

                expect(err).to.not.exist;
                expect(body).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the file function with the build-in handler config', function (done) {

            server.addRoute({ method: 'GET', path: '/filefn/{file}', handler: { file: filenameFn } });

            Request.get('http://localhost:17082/filefn/index.js', function (err, res, body) {

                expect(err).to.not.exist;
                expect(body).to.contain('./lib');
                expect(res.headers['content-type']).to.equal('application/javascript');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file in the response with the correct headers (relative path)', function (done) {

            var relativeHandler = function (request) {

                request.reply(new Hapi.Response.File('./package.json'));
            };

            server.addRoute({ method: 'GET', path: '/relativefile', handler: relativeHandler });

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

        it('returns a file using the built-in handler config (relative path)', function (done) {

            server.addRoute({ method: 'GET', path: '/relativestaticfile', handler: { file: '../../package.json' } });

            Request.get('http://localhost:17082/relativestaticfile', function (err, res, body) {

                expect(err).to.not.exist;
                expect(body).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
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

                var date = new Date(Date.now());
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

        it('throws an error when adding a route with a parameter and string path', function (done) {

            var fn = function () {

                server.addRoute({ method: 'GET', path: '/fileparam/{path}', handler: { file: './package.json' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error when adding a route with a parameter and function path', function (done) {

            var fn = function () {

                server.addRoute({ method: 'GET', path: '/fileparam/{path}', handler: { file: function () { } } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('Directory', function () {

        var server = new Hapi.Server(17083);
        server.addRoute({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: '../..' } } });
        server.addRoute({ method: 'GET', path: '/showhidden/{path*}', handler: { directory: { path: '../..', showHidden: true, listing: true } } });
        server.addRoute({ method: 'GET', path: '/noshowhidden/{path*}', handler: { directory: { path: '../..', listing: true } } });

        it('returns a 403 when no index exists and listing is disabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directory', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        it('returns a 403 when requesting a path containing \'..\'', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directory/..', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        it('returns a 404 when requesting an unknown file within a directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directory/xyz', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a file when requesting a file from the directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directory/package.json', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('hapi');
                    done();
                });
            });
        });

        it('returns the correct file when requesting a file from a child directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directory/test/integration/response.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('http://localhost:17083/directory//test/integration/response.js');
                    done();
                });
            });
        });

        it('returns a 403 when index and listing are disabled', function (done) {

            server.addRoute({ method: 'GET', path: '/directoryx/{path*}', handler: { directory: { path: '../../', index: false } } });

            server.start(function () {

                Request.get('http://localhost:17083/directoryx', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        server.addRoute({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../../', listing: true } } });

        it('returns a list of files when listing is enabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directorylist', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        it('returns a list of files for subdirectory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directorylist/test', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('integration');
                    done();
                });
            });
        });

        it('returns a list of files when listing is enabled and index disabled', function (done) {

            server.addRoute({ method: 'GET', path: '/directorylistx/{path*}', handler: { directory: { path: '../../', listing: true, index: false } } });

            server.start(function () {

                Request.get('http://localhost:17083/directorylistx', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        server.addRoute({ method: 'GET', path: '/directoryIndex/{path*}', handler: { directory: { path: './directory/' } } });

        it('returns the index when found', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directoryIndex', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('<p>test</p>');
                    done();
                });
            });
        });

        it('returns a 500 when index.html is a directory', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/directoryIndex/invalid', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        it('returns the correct file when using a fn directory handler', function (done) {

            var directoryFn = function (request) {

                return '../../lib';
            };

            server.addRoute({ method: 'GET', path: '/directoryfn/{path?}', handler: { directory: { path: directoryFn } } });

            server.start(function () {

                Request.get('http://localhost:17083/directoryfn/log.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('export');
                    done();
                });
            });
        });

        it('returns listing with hidden files when hidden files should be shown', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/showhidden', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('.gitignore');
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        it('returns listing without hidden files when hidden files should not be shown', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/noshowhidden', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.not.contain('.gitignore');
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        it('returns a 404 response when requesting a hidden file when showHidden is disabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/noshowhidden/.gitignore', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a file when requesting a hidden file when showHidden is enabled', function (done) {

            server.start(function () {

                Request.get('http://localhost:17083/showhidden/.gitignore', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('node_modules');
                    done();
                });
            });
        });
    });

    describe('Stream', function () {

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

        var handler = function (request) {

            request.reply.stream(new FakeStream(request.params.issue)).bytes(request.params.issue ? 0 : 1).send();
        };

        var server = new Hapi.Server();
        server.addRoute({ method: 'GET', path: '/stream/{issue?}', handler: handler });

        it('returns a stream reply', function (done) {

            server.inject({ method: 'GET', url: '/stream' }, function (res) {

                expect(res.readPayload()).to.equal('x');
                done();
            });
        });

        it('returns a broken stream reply on error issue', function (done) {

            server.inject({ method: 'GET', url: '/stream/error' }, function (res) {

                expect(res.readPayload()).to.equal('');
                done();
            });
        });

        it('returns a broken stream reply on double issue', function (done) {

            server.inject({ method: 'GET', url: '/stream/double' }, function (res) {

                expect(res.readPayload()).to.equal('x');
                done();
            });
        });
    });

    describe('Cached', function () {

        it('returns a cached reply', function (done) {

            var cacheHandler = function (request) {

                request.reply({ status: 'cached' });
            };

            var server = new Hapi.Server({ cache: { engine: 'memory' } });
            server.addRoute({ method: 'GET', path: '/cache', config: { handler: cacheHandler, cache: { expiresIn: 5000 } } });

            server.inject({ method: 'GET', url: '/cache' }, function (res1) {

                expect(res1.result).to.exist;
                expect(res1.result.status).to.equal('cached');

                server.inject({ method: 'GET', url: '/cache' }, function (res2) {

                    expect(res2.readPayload()).to.equal('{"status":"cached"}');
                    done();
                });
            });
        });
    });

    describe('#_respond', function () {

        it('returns an error reply on invalid Response._respond', function (done) {

            var handler = function (request) {

                Hapi.Response._respond(null, request, function () { });
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
                done();
            });
        });
    });

    describe('#format.payload', function () {

        it('returns a formatted reply', function (done) {

            var formatPayload = function (result) {

                return result + '!';
            };

            var handler = function (request) {

                request.reply('hello');
            };

            var server = new Hapi.Server({ format: { payload: formatPayload } });
            server.addRoute({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('hello!');
                done();
            });
        });
    });
});
