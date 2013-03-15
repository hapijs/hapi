// Load modules

var Lab = require('lab');
var Fs = require('fs');
var Stream = require('stream');
var Request = require('request');
var Hapi = require('../..');
var ResponseError = require('../../lib/response/error');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Response', function () {

    describe('Text', function () {

        it('returns a text reply', function (done) {

            var handler = function (request) {

                request.reply.payload('text\0!')
                             .type('text/plain')
                             .encoding('ascii')
                             .ttl(1000)
                             .state('sid', 'abcdefg123456')
                             .state('other', 'something', { isSecure: true })
                             .unstate('x')
                             .header('Content-Type', 'text/plain; something=something')
                             .send();
            };

            var handlerBound = function () {

                this.reply('Tada');
            };

            var server = new Hapi.Server({ cache: { engine: 'memory' }, cors: { origin: ['test.example.com', 'www.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });
            server.route({ method: 'GET', path: '/bound', config: { handler: handlerBound } });
            server.state('sid', { encoding: 'base64' });
            server.ext('onPostHandler', function (request, next) {

                request.setState('test', '123');
                request.clearState('empty');
                next();
            });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.payload).to.exist;
                expect(res.payload).to.equal('text !');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com www.example.com');
                expect(res.headers['access-control-allow-credentials']).to.not.exist;
                expect(res.headers['set-cookie']).to.deep.equal(['sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', "test=123", "empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);

                server.inject({ method: 'GET', url: '/bound', headers: { origin: 'www.example.com' } }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.equal('Tada');
                    expect(res.headers['access-control-allow-origin']).to.equal('www.example.com');
                    done();
                });
            });
        });

        it('returns an error on bad cookie', function (done) {

            var handler = function (request) {

                request.reply.payload('text')
                             .state(';sid', 'abcdefg123456')
                             .send();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
                expect(res.headers['set-cookie']).to.not.exist;
                done();
            });
        });
    });

    describe('Buffer', function () {

        it('returns a reply', function (done) {

            var handler = function () {

                this.reply(new Buffer('Tada'));
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('Tada');
                done();
            });
        });
    });

    describe('Obj', function () {

        it('returns an JSONP response', function (done) {

            var handler = function (request) {

                request.reply({ some: 'value' });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject({ method: 'GET', url: '/?callback=me' }, function (res) {

                expect(res.payload).to.equal('me({"some":"value"});');
                expect(res.headers['content-length']).to.equal(21);
                done();
            });
        });

        it('returns an JSONP response when response is a buffer', function (done) {

            var handler = function (request) {

                request.reply(new Buffer('value'));
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject({ method: 'GET', url: '/?callback=me' }, function (res) {

                expect(res.payload).to.equal('me(value);');
                expect(res.headers['content-length']).to.equal(10);
                done();
            });
        });

        it('returns response on bad JSONP parameter', function (done) {

            var handler = function (request) {

                request.reply({ some: 'value' });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject({ method: 'GET', url: '/?callback=me*' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.message).to.equal('Invalid JSONP parameter value');
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
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('boom');
                done();
            });
        });

        it('returns an error response reply', function (done) {

            var handler = function (request) {

                var error = new ResponseError(Hapi.error.internal('kaboom'));
                request.reply(error);
            };

            var server = new Hapi.Server();

            server.once('internalError', function (request, err) {

                expect(err).to.exist;
                expect(err.trace[0]).to.contain('test/integration/response');
                done();
            });

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
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

        var server = new Hapi.Server({ cors: { credentials: true } });
        server.route([
            { method: 'GET', path: '/', handler: handler },
        ]);

        it('returns an empty reply', function (done) {

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('');
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });

        it('returns an empty reply (long form)', function (done) {

            server.inject({ method: 'GET', url: '/?x=1' }, function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });
    });

    describe('Raw', function () {

        it('returns a reply', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Raw(request)
                    .type('text/plain')
                    .bytes(13)
                    .ttl(1000)
                    .state('sid', 'abcdefg123456');

                response.begin(function (err) {

                    response.write('!hola ')
                            .write('amigos!');

                    request.reply(response);
                });
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.deep.equal(['sid=abcdefg123456']);
                expect(res.result).to.equal('!hola amigos!');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a reply using send()', function (done) {

            var handler = function (request) {

                var response = request.reply.raw();
                response.type('text/plain')
                        .bytes(13)
                        .ttl(1000)
                        .state('sid', 'abcdefg123456');

                response.begin(function (err) {

                    response.write('!hola ')
                            .write('amigos!')
                            .send();
                });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.deep.equal(['sid=abcdefg123456']);
                expect(res.result).to.equal('!hola amigos!');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.not.exist;
                done();
            });
        });

        it('returns a reply with no payload', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Raw(request)
                    .code(299)
                    .type('text/plain')
                    .bytes(13)
                    .state('sid', 'abcdefg123456');

                request.reply(response);
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.headers['set-cookie']).to.deep.equal(['sid=abcdefg123456']);
                expect(res.result).to.equal('');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a HEAD reply', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Raw(request)
                    .type('text/plain')
                    .bytes(13)
                    .ttl(1000)
                    .state('sid', 'abcdefg123456');

                response.begin(function (err) {

                    response.write('!hola ')
                            .write('amigos!');

                    request.reply(response);
                });
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'HEAD', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.deep.equal(['sid=abcdefg123456']);
                expect(res.result).to.equal('');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a reply (created)', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Raw(request)
                    .created('me')
                    .type('text/plain')
                    .bytes(13)
                    .ttl(1000)
                    .state('sid', 'abcdefg123456');

                response.begin(function (err) {

                    response.write('!hola ')
                            .write('amigos!');

                    request.reply(response);
                });
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal(server.settings.uri + '/me');
                expect(res.headers['set-cookie']).to.deep.equal(['sid=abcdefg123456']);
                expect(res.result).to.equal('!hola amigos!');
                expect(res.headers['cache-control']).to.equal('no-cache');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a error on bad cookie', function (done) {

            var handler = function (request) {

                var response = new Hapi.Response.Raw(request)
                    .bytes(13)
                    .state(';sid', 'abcdefg123456');

                response.begin(function (err) {

                    response.write('!hola ')
                            .write('amigos!');

                    request.reply(response);
                });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(200);       // Too late to change at this point
                expect(res.headers['set-cookie']).to.not.exist;
                expect(res.result).to.equal('!hola amigos!');
                done();
            });
        });
    });

    describe('File', function () {

        it('returns a file in the response with the correct headers', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.start(function () {

                Request.get(server.settings.uri + '/file', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    expect(res.headers['content-disposition']).to.equal('inline; filename=package.json');
                    done();
                });
            });
        });

        it('returns a file in the response with the correct headers using cwd relative paths', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'cwd' } });
            server.route({ method: 'GET', path: '/', handler: { file: './package.json' } });

            server.start(function () {

                Request.get(server.settings.uri, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    expect(res.headers['content-disposition']).to.equal('inline; filename=package.json');
                    done();
                });
            });
        });

        it('returns a 404 when the file is not found', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: '/no/such/path/x1' } });

            server.route({ method: 'GET', path: '/filenotfound', handler: { file: 'nopes' } });

            server.start(function () {

                Request.get(server.settings.uri + '/filenotfound', function (err, res) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a 403 when the file is a directory', function (done) {

            var server = new Hapi.Server(0);

            server.route({ method: 'GET', path: '/filefolder', handler: { file: 'examples' } });

            server.start(function () {

                Request.get(server.settings.uri + '/filefolder', function (err, res) {

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

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../../package.json' } });

            server.start(function () {

                Request.get(server.settings.uri + '/staticfile', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a file using the file function with the build-in handler config', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/filefn/{file}', handler: { file: filenameFn } });

            server.start(function () {

                Request.get(server.settings.uri + '/filefn/index.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('./lib');
                    expect(res.headers['content-type']).to.equal('application/javascript');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a file in the response with the correct headers (relative path)', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            var relativeHandler = function (request) {

                request.reply(new Hapi.Response.File('./package.json'));
            };

            server.route({ method: 'GET', path: '/relativefile', handler: relativeHandler });

            server.start(function () {

                Request.get(server.settings.uri + '/relativefile', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a file using the built-in handler config (relative path)', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/relativestaticfile', handler: { file: '../../package.json' } });

            server.start(function () {

                Request.get(server.settings.uri + '/relativestaticfile', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('hapi');
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-length']).to.exist;
                    done();
                });
            });
        });

        it('returns a 304 when the request has a matching etag', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.start(function () {

                Request.get(server.settings.uri + '/file', function (err, res1) {

                    var headers = {
                        'if-none-match': res1.headers.etag
                    };

                    Request.get({ url: server.settings.uri + '/file', headers: headers }, function (err, res2) {

                        expect(res2.statusCode).to.equal(304);
                        done();
                    });
                });
            });
        });

        it('invalidates etags when file changes', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });

            server.route({ method: 'GET', path: '/note', handler: { file: './file/note.txt' } });

            // No etag, never requested

            server.inject({ method: 'GET', url: '/note' }, function (res1) {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result).to.equal('Test');
                expect(res1.headers.etag).to.not.exist;

                // No etag, previously requested

                server.inject({ method: 'GET', url: '/note' }, function (res2) {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result).to.equal('Test');
                    expect(res2.headers.etag).to.exist;

                    var etag1 = res2.headers.etag;

                    // etag

                    server.inject({ method: 'GET', url: '/note', headers: { 'if-none-match': etag1 } }, function (res3) {

                        expect(res3.statusCode).to.equal(304);

                        var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                        Fs.writeSync(fd, new Buffer('Test'), 0, 4);
                        Fs.closeSync(fd);

                        // etag after file modified, content unchanged

                        server.inject({ method: 'GET', url: '/note', headers: { 'if-none-match': etag1 } }, function (res4) {

                            expect(res4.statusCode).to.equal(200);
                            expect(res4.result).to.equal('Test');
                            expect(res4.headers.etag).to.not.exist;

                            // No etag, previously requested

                            server.inject({ method: 'GET', url: '/note' }, function (res5) {

                                expect(res5.statusCode).to.equal(200);
                                expect(res5.result).to.equal('Test');
                                expect(res5.headers.etag).to.exist;

                                var etag2 = res5.headers.etag;
                                expect(etag1).to.equal(etag2);

                                var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                                Fs.writeSync(fd, new Buffer('Test1'), 0, 5);
                                Fs.closeSync(fd);

                                // etag after file modified, content changed

                                server.inject({ method: 'GET', url: '/note', headers: { 'if-none-match': etag2 } }, function (res6) {

                                    expect(res6.statusCode).to.equal(200);
                                    expect(res6.result).to.equal('Test1');
                                    expect(res6.headers.etag).to.not.exist;

                                    // No etag, previously requested

                                    server.inject({ method: 'GET', url: '/note' }, function (res7) {

                                        expect(res7.statusCode).to.equal(200);
                                        expect(res7.result).to.equal('Test1');
                                        expect(res7.headers.etag).to.exist;

                                        var etag3 = res7.headers.etag;
                                        expect(etag1).to.not.equal(etag3);

                                        var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                                        Fs.writeSync(fd, new Buffer('Test'), 0, 4);
                                        Fs.closeSync(fd);

                                        // No etag, content restored

                                        server.inject({ method: 'GET', url: '/note' }, function (res8) {

                                            expect(res8.statusCode).to.equal(200);
                                            expect(res8.result).to.equal('Test');

                                            // No etag, previously requested

                                            server.inject({ method: 'GET', url: '/note' }, function (res9) {

                                                expect(res9.statusCode).to.equal(200);
                                                expect(res9.result).to.equal('Test');
                                                expect(res9.headers.etag).to.exist;

                                                var etag4 = res9.headers.etag;
                                                expect(etag1).to.equal(etag4);

                                                done();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        it('returns a 304 when the request has if-modified-since and the response hasn\'t been modified since', function (done) {

            var server = new Hapi.Server(0);
            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.start(function () {

                Request.get({ url: server.settings.uri + '/file' }, function (err, res1) {

                    var headers = {
                        'if-modified-since': res1.headers.date
                    };

                    Request.get({ url: server.settings.uri + '/file', headers: headers }, function (err, res2) {

                        expect(res2.statusCode).to.equal(304);
                        done();
                    });
                });
            });
        });

        it('returns a gzipped file in the response when the request accepts gzip', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.start(function () {

                Request.get({ url: server.settings.uri + '/file', headers: { 'accept-encoding': 'gzip' } }, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-encoding']).to.equal('gzip');
                    expect(res.headers['content-length']).to.not.exist;
                    expect(body).to.exist;
                    done();
                });
            });
        });

        it('returns a deflated file in the response when the request accepts deflate', function (done) {

            var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.Response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.start(function () {

                Request.get({ url: server.settings.uri + '/file', headers: { 'accept-encoding': 'deflate' } }, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.headers['content-type']).to.equal('application/json');
                    expect(res.headers['content-encoding']).to.equal('deflate');
                    expect(res.headers['content-length']).to.not.exist;
                    expect(body).to.exist;
                    done();
                });
            });
        });

        it('throws an error when adding a route with a parameter and string path', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
                server.route({ method: 'GET', path: '/fileparam/{path}', handler: { file: './package.json' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error when adding a route with a parameter and function path', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
                server.route({ method: 'GET', path: '/fileparam/{path}', handler: { file: function () { } } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('Directory', function () {

        var server = new Hapi.Server(0, { files: { relativeTo: 'routes' } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: '.' } } });      // Use '.' to test path normalization
        server.route({ method: 'GET', path: '/showhidden/{path*}', handler: { directory: { path: './', showHidden: true, listing: true } } });
        server.route({ method: 'GET', path: '/noshowhidden/{path*}', handler: { directory: { path: './', listing: true } } });
        server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './', index: true, listing: true } } });
        server.route({ method: 'GET', path: '/showindex/{path*}', handler: { directory: { path: './', index: true, listing: true } } });
        server.route({ method: 'GET', path: '/multiple/{path*}', handler: { directory: { path: ['./', '../'], listing: true } } });

        it('returns a 403 when no index exists and listing is disabled', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directory/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        it('returns a 403 when requesting a path containing \'..\'', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directory/..', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        it('returns a 404 when requesting an unknown file within a directory', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directory/xyz', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a file when requesting a file from the directory', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directory/response.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('hapi');
                    done();
                });
            });
        });

        it('returns a file when requesting a file from multi directory setup', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/multiple/unit/response/directory.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('no_such_path');
                    done();
                });
            });
        });

        it('returns the correct file when requesting a file from a child directory', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directory/directory/index.html', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('test');
                    done();
                });
            });
        });

        it('returns the correct listing links when viewing top level path', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('href="/response.js"');
                    done();
                });
            });
        });

        it('doesn\'t contain any double / when viewing sub path listing', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/showindex/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.not.contain('//');
                    done();
                });
            });
        });

        it('has the correct link to sub folders when inside of a sub folder listing', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/showindex/directory/subdir', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('href="/showindex/directory/subdir/subsubdir"');
                    done();
                });
            });
        });

        it('returns a 403 when index and listing are disabled', function (done) {

            server.route({ method: 'GET', path: '/directoryx/{path*}', handler: { directory: { path: '../../', index: false } } });

            server.start(function () {

                Request.get(server.settings.uri + '/directoryx/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(403);
                    done();
                });
            });
        });

        server.route({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../../', listing: true } } });

        it('returns a list of files when listing is enabled', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directorylist/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        it('returns a list of files for subdirectory', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directorylist/test', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('integration');
                    done();
                });
            });
        });

        it('returns a list of files when listing is enabled and index disabled', function (done) {

            server.route({ method: 'GET', path: '/directorylistx/{path*}', handler: { directory: { path: '../../', listing: true, index: false } } });

            server.start(function () {

                Request.get(server.settings.uri + '/directorylistx/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('package.json');
                    done();
                });
            });
        });

        server.route({ method: 'GET', path: '/directoryIndex/{path*}', handler: { directory: { path: './directory/' } } });

        it('returns the index when found', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directoryIndex/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('<p>test</p>');
                    done();
                });
            });
        });

        it('returns a 500 when index.html is a directory', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/directoryIndex/invalid', function (err, res, body) {

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

            server.route({ method: 'GET', path: '/directoryfn/{path?}', handler: { directory: { path: directoryFn } } });

            server.start(function () {

                Request.get(server.settings.uri + '/directoryfn/defaults.js', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(body).to.contain('export');
                    done();
                });
            });
        });

        it('returns listing with hidden files when hidden files should be shown', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/showhidden/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('.hidden');
                    done();
                });
            });
        });

        it('returns listing without hidden files when hidden files should not be shown', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/noshowhidden/', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.not.contain('.hidden');
                    expect(body).to.contain('response.js');
                    done();
                });
            });
        });

        it('returns a 404 response when requesting a hidden file when showHidden is disabled', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/noshowhidden/.hidden', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it('returns a file when requesting a hidden file when showHidden is enabled', function (done) {

            server.start(function () {

                Request.get(server.settings.uri + '/showhidden/.hidden', function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body).to.contain('test');
                    done();
                });
            });
        });
    });

    describe('Stream', function () {

        var _streamRequest = null;

        FakeStream = function (issue) {

            Stream.call(this);
            this.pause = this.resume = this.setEncoding = function () { };
            var self = this;
            this.destroy = function () {

                self.readable = false;
            };
            this.issue = issue;
            return this;
        };

        Hapi.utils.inherits(FakeStream, Stream);

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

                case 'closes':
                    if (event === 'data') {
                        callback('here is the response');
                    }
                    else if (event === 'end') {
                        _streamRequest.raw.req.emit('close');
                        callback();
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

            _streamRequest = request;
            request.reply.stream(new FakeStream(request.params.issue))
                         .bytes(request.params.issue ? 0 : 1)
                         .ttl(2000)
                         .send();
        };

        var handler2 = function (request) {

            var stream = new Stream();
            stream.readable = true;
            stream.resume = function () {

                stream.emit('end', 'hello');
            };
            stream.response = {
                headers: {
                    custom: 'header'
                }
            };

            var streamRes = new Hapi.response.Stream(stream);
            request.reply(streamRes);
        };

        var handler3 = function (request) {

            _streamRequest = request;
            request.reply.stream(new FakeStream(request.params.issue))
                         .created('/special')
                         .bytes(request.params.issue ? 0 : 1)
                         .ttl(3000)
                         .send();
        };

        var handler4 = function (request) {

            _streamRequest = request;
            request.reply.stream(new FakeStream())
                         .state(';sid', 'abcdefg123456')
                         .send();
        };

        var handler5 = function (request) {

            var stream = new Stream();
            stream.readable = true;
            stream.resume = function () {

                stream.emit('end', 'hello');
            };
            stream.response = {
                code: 201
            };

            var streamRes = new Hapi.response.Stream(stream);
            request.reply(streamRes);
        };

        var server = new Hapi.Server('0.0.0.0', 19798, { cors: { origin: ['test.example.com'] } });
        server.route({ method: 'GET', path: '/stream/{issue?}', config: { handler: handler, cache: { mode: 'client', expiresIn: 9999 } } });
        server.route({ method: 'POST', path: '/stream/{issue?}', config: { handler: handler } });
        server.route({ method: 'GET', path: '/stream2', config: { handler: handler2 } });
        server.route({ method: 'GET', path: '/stream3', config: { handler: handler3, cache: { mode: 'client', expiresIn: 9999 } } });
        server.route({ method: 'GET', path: '/stream4', config: { handler: handler4 } });
        server.route({ method: 'GET', path: '/stream5', config: { handler: handler5 } });

        it('returns a stream reply', function (done) {

            server.inject({ method: 'GET', url: '/stream/' }, function (res) {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a stream reply with custom response headers', function (done) {

            server.inject({ method: 'GET', url: '/stream2' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.custom).to.equal('header');
                done();
            });
        });

        it('returns a stream reply with custom response status code', function (done) {

            server.inject({ method: 'GET', url: '/stream5' }, function (res) {

                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('returns a gzipped stream reply without a content-length header when accept-encoding is gzip', function (done) {

            var streamHandler = function (request) {

                var stream = new Stream();
                stream.readable = true;
                stream.resume = function () {

                    setTimeout(function () {

                        stream.emit('end', 'hi');
                    }, 5);
                };

                request.reply.stream(stream).send();
            };

            var server1 = new Hapi.Server(0);
            server1.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server1.start(function () {

                Request.get({ uri: server1.settings.uri + '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } }, function (err, res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['content-length']).to.not.exist;
                    done();
                });
            });
        });

        it('returns a deflated stream reply without a content-length header when accept-encoding is deflate', function (done) {

            var streamHandler = function (request) {

                var stream = new Stream();
                stream.readable = true;
                stream.resume = function () {

                    setTimeout(function () {

                        stream.emit('end', 'hi');
                    }, 5);
                };

                request.reply.stream(stream).send();
            };

            var server1 = new Hapi.Server(0);
            server1.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server1.start(function () {

                Request.get({ uri: server1.settings.uri + '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } }, function (err, res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['content-length']).to.not.exist;
                    done();
                });
            });
        });

        it('returns a stream reply (created)', function (done) {

            server.inject({ method: 'GET', url: '/stream3' }, function (res) {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal(server.settings.uri + '/special');
                expect(res.headers['cache-control']).to.equal('no-cache');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns an error on bad state', function (done) {

            server.inject({ method: 'GET', url: '/stream4' }, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns a broken stream reply on error issue', function (done) {

            server.inject({ method: 'GET', url: '/stream/error' }, function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('returns a broken stream reply on double issue', function (done) {

            server.inject({ method: 'GET', url: '/stream/double' }, function (res) {

                expect(res.result).to.equal('x');
                done();
            });
        });

        it('stops processing the stream when the request closes', function (done) {

            server.start(function () {

                Request.get({ uri: 'http://127.0.0.1:19798/stream/closes', headers: { 'Accept-Encoding': 'gzip' } }, function (err, res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('should destroy downward stream on request stream closing', function (done) {

            var tmpFile = '/tmp/test.json';
            var output = JSON.stringify({ "x": "aaaaaaaaaaaa" });
            Fs.writeFileSync(tmpFile, output);
            var testStream = Fs.createReadStream(tmpFile);

            server.start(function () {

                testStream.pipe(Request.get({ uri: 'http://127.0.0.1:19798/stream/closes', headers: { 'Content-Type': 'application/json' } }, function (err, res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                }));
            });
        });
    });

    describe('Cached', function () {

        it('returns a cached reply', function (done) {

            var cacheHandler = function (request) {

                request.reply({ status: 'cached' });
            };

            var server = new Hapi.Server(0, { cache: { engine: 'memory' } });
            server.route({ method: 'GET', path: '/cache', config: { handler: cacheHandler, cache: { expiresIn: 5000 } } });

            server.start(function () {

                server.inject({ method: 'GET', url: '/cache' }, function (res1) {

                    expect(res1.result).to.exist;
                    expect(res1.result.status).to.equal('cached');

                    server.inject({ method: 'GET', url: '/cache' }, function (res2) {

                        expect(res2.result).to.equal('{"status":"cached"}');
                        done();
                    });
                });
            });
        });
    });

    describe('View', function () {

        var viewPath = __dirname + '/../unit/templates/valid';
        var msg = "Hello, World!";

        var handler = function (request) {

            return request.reply.view('test', { message: msg }).send();
        };
        var absoluteHandler = function (request) {

            return request.reply.view(viewPath + '/test', { message: msg }).send();
        };
        var insecureHandler = function (request) {

            return request.reply.view('../test', { message: msg }).send();
        };
        var nonexistentHandler = function (request) {

            return request.reply.view('testNope', { message: msg }).send();
        };
        var invalidHandler = function (request) {

            return request.reply.view('badmustache', { message: msg }, { path: viewPath + '/../invalid' }).send();
        };
        var layoutConflictHandler = function (request) {

            return request.reply.view('test', { message: msg, content: 'fail' }).send();
        };
        var layoutErrHandler = function (request) {

            return request.reply.view('test', { message: msg }, { path: viewPath + '/../invalid' }).send();
        };
        var testMultiHandlerJade = function (request) {

            return request.reply.view('testMulti', { message: "Hello World!" }).send();
        };
        var testMultiHandlerHB = function (request) {

            return request.reply.view('test', { message: "Hello World!" }).send();
        };

        describe('Default', function (done) {

            var server = new Hapi.Server({
                views: {
                    path: viewPath
                }
            });
            server.route({ method: 'GET', path: '/views', config: { handler: handler } });
            server.route({ method: 'GET', path: '/views/abspath', config: { handler: absoluteHandler } });
            server.route({ method: 'GET', path: '/views/insecure', config: { handler: insecureHandler } });
            server.route({ method: 'GET', path: '/views/nonexistent', config: { handler: nonexistentHandler } });
            server.route({ method: 'GET', path: '/views/invalid', config: { handler: invalidHandler } });

            it('returns a compiled Handlebars template reply', function (done) {

                server.inject({ method: 'GET', url: '/views' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.have.string(msg);
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });

            it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

                server.inject({ method: 'GET', url: '/views/abspath' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if path given includes ../ and allowInsecureAccess is false (by default)', function (done) {

                server.inject({ method: 'GET', url: '/views/insecure' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if template does not exist', function (done) {

                server.inject({ method: 'GET', url: '/views/nonexistent' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if engine.compile throws', function (done) {

                server.inject({ method: 'GET', url: '/views/invalid' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        describe('Layout', function (done) {

            var layoutServer = new Hapi.Server({
                views: {
                    path: viewPath,
                    layout: true
                }
            });
            layoutServer.route({ method: 'GET', path: '/layout/conflict', config: { handler: layoutConflictHandler } });
            layoutServer.route({ method: 'GET', path: '/layout/abspath', config: { handler: layoutErrHandler } });

            it('returns error on layoutKeyword conflict', function (done) {

                layoutServer.inject({ method: 'GET', url: '/layout/conflict' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                })
            });

            it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

                layoutServer.inject({ method: 'GET', url: '/layout/abspath' }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        describe('Engine Support', function () {

            describe('Caching', function () {

                it('should not throw if local cache disabled', function (done) {

                    var fn = function () {

                        var testServer = new Hapi.Server({
                            views: {
                                path: viewPath,
                                engines: {
                                    'html': {
                                        module: 'handlebars',
                                        cache: false
                                    },
                                }
                            }
                        });
                        testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                        testServer.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                            expect(res.result).to.exist;
                            expect(res.statusCode).to.equal(200);
                            testServer.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                                expect(res.result).to.exist;
                                expect(res.statusCode).to.equal(200);
                                // done();
                            });
                        });
                    };
                    expect(fn).to.not.throw();
                    done();
                });

                it('should use the cache if all caching enabled', function (done) {

                    var testServer = new Hapi.Server({
                        views: {
                            path: viewPath,
                            cache: {},
                            engines: {
                                'html': {
                                    module: 'handlebars'
                                }
                            }
                        }
                    });
                    testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                    testServer.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        testServer.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                            expect(res.result).to.exist;
                            expect(res.statusCode).to.equal(200);
                            done();
                        });
                    });
                });

                it('should not throw if global cache disabled', function (done) {

                    var testServer = new Hapi.Server({
                        views: {
                            path: viewPath,
                            cache: false,
                            engine: {
                                module: 'handlebars',
                                extension: 'html',
                                slashReplacement: '_',
                            }
                        }
                    });
                    testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                    testServer.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });
            });

            describe('General', function () {

                it('should not throw if view map has execute function defined', function (done) {

                    var fn = function () {

                        var testServer = new Hapi.Server({
                            views: {
                                path: viewPath,
                                engines: {
                                    'html': {
                                        module: {
                                            compile: function (tmpl, options) {

                                                return function (ctx) {

                                                    return tmpl;
                                                }
                                            }
                                        },
                                        map: {
                                            execute: (function () {

                                                return function (engine, compiled, ctx, options, partials) {

                                                    return function (ctx, options) {

                                                        return compiled(ctx, options);
                                                    }
                                                }
                                            })
                                        }
                                    }
                                }
                            }
                        });
                        testServer.route({ method: 'GET', path: '/exec', config: { handler: testMultiHandlerHB } });
                        testServer.inject({ method: 'GET', url: '/exec' }, function (res) {

                            expect(res.result).to.exist;
                            expect(res.statusCode).to.equal(200);
                            // done();
                        });
                    };
                    expect(fn).to.not.throw();
                    done();
                });

                it('should throw if view module not found', function (done) {

                    var fn = function () {

                        var failServer = new Hapi.Server({
                            views: {
                                path: viewPath,
                                engines: {
                                    'html': { module: 'handlebars' },
                                    'jade': { module: 'jade' },
                                    'hbar': {
                                        module: 'handlebars',
                                        map: {
                                            compile: function (engine) { return engine.compile; }
                                        }
                                    },
                                    'err': {
                                        module: 'hapi-module-that-does-not-exist'
                                    }
                                }
                            }
                        });
                    };
                    expect(fn).to.throw();
                    done();
                });

                it('should work if view engine module is a pre-required module', function (done) {

                    var options = {
                        views: {
                            path: viewPath,
                            engines: {
                                'test': {
                                    module: require('jade')
                                }
                            }
                        }
                    };
                    var fn = function () {

                        var passServer = new Hapi.Server(options);
                    };
                    expect(fn).to.not.throw();
                    done();
                });
            });

            describe('Single', function () {

                var server = new Hapi.Server({
                    views: {
                        path: viewPath,
                        engine: {
                            module: 'handlebars',
                            extension: 'html',
                            slashReplacement: '_',
                        }
                    }
                });

                server.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });

                it('should render handlebars template', function (done) {

                    server.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });
            });

            describe('Multiple', function () {

                var server = new Hapi.Server({
                    views: {
                        path: viewPath,
                        engines: {
                            'html': { module: 'handlebars' },
                            'jade': { module: 'jade' },
                            'hbar': {
                                module: 'handlebars',
                                map: {
                                    compile: function (engine) { return engine.compile; }
                                }
                            },
                        }
                    }
                });
                server.route({ method: 'GET', path: '/jade', config: { handler: testMultiHandlerJade } });
                server.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });


                it('should render jade template', function (done) {

                    server.inject({ method: 'GET', url: '/jade' }, function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });

                it('should render handlebars template', function (done) {

                    server.inject({ method: 'GET', url: '/handlebars' }, function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });
            });
        });
    });

    describe('Redirection', function () {

        var handler = function (request) {

            if (!request.query.x) {
                return request.reply.redirect('example').send();
            }

            if (request.query.x === 'verbose') {
                return request.reply.redirect().uri('examplex').message('We moved!').send();
            }

            if (request.query.x === '302') {
                return request.reply.redirect('example').temporary().rewritable().send();
            }

            if (request.query.x === '307') {
                return request.reply.redirect('example').temporary().rewritable(false).send();
            }

            if (request.query.x === '301') {
                return request.reply.redirect('example').permanent().rewritable().send();
            }

            if (request.query.x === '308') {
                return request.reply.redirect('example').permanent().rewritable(false).send();
            }

            if (request.query.x === '302f') {
                return request.reply.redirect('example').rewritable().temporary().send();
            }

            if (request.query.x === '307f') {
                return request.reply.redirect('example').rewritable(false).temporary().send();
            }

            if (request.query.x === '301f') {
                return request.reply.redirect('example').rewritable().permanent().send();
            }

            if (request.query.x === '308f') {
                return request.reply.redirect('example').rewritable(false).permanent().send();
            }
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/redirect', config: { handler: handler } });

        before(function (done) {

            server.start(done);
        });

        it('returns a redirection reply', function (done) {

            server.inject({ method: 'GET', url: '/redirect' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('You are being redirected...');
                expect(res.headers['location']).to.equal(server.settings.uri + '/example');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a redirection reply using verbose call', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=verbose' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('We moved!');
                expect(res.headers['location']).to.equal(server.settings.uri + '/examplex');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 301 redirection reply', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=301' }, function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=302' }, function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=307' }, function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=308' }, function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 301 redirection reply (reveresed methods)', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=301f' }, function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply (reveresed methods)', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=302f' }, function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply (reveresed methods)', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=307f' }, function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply (reveresed methods)', function (done) {

            server.inject({ method: 'GET', url: '/redirect?x=308f' }, function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });
    });

    describe('External', function () {

        it('returns a reply', function (done) {

            var handler = function () {

                this.raw.res.end();
                this.reply.close();
            };

            var server = new Hapi.Server({ cache: { engine: 'memory' } });
            server.route({ method: 'GET', path: '/throw', config: { handler: handler, cache: { mode: 'server', expiresIn: 9999 } } });
            server.route({ method: 'GET', path: '/null', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/null' }, function (res) {

                expect(res.result).to.equal('');

                expect(function () {

                    server.inject({ method: 'GET', url: '/throw' }, function (res) { });
                }).to.throw();

                done();
            });
        });
    });

    describe('Extension', function () {

        it('returns a reply using custom response without _prepare', function (done) {

            var handler = function () {

                var custom = {
                    variety: 'x-custom',
                    varieties: { 'x-custom': true },
                    _transmit: function (request, callback) {

                        request.raw.res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': 11 });
                        request.raw.res.end('Hello World');
                    }
                };

                this.reply(custom);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('Hello World');
                done();
            });
        });

        it('returns an internal error on error response loop', function (done) {

            var handler = function () {

                var custom = {
                    variety: 'x-custom',
                    varieties: { 'x-custom': true },
                    _prepare: function (request, callback) {

                        callback(Hapi.error.badRequest());
                    },
                    _transmit: function () { }
                };

                this.setState('bad', {});
                this.reply(custom);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns an error on infinite _prepare loop', function (done) {

            var handler = function () {

                var custom = {
                    variety: 'x-custom',
                    varieties: { 'x-custom': true },
                    _prepare: function (request, callback) {

                        callback(custom);
                    }
                };

                this.reply(custom);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result.code).to.equal(500);
                done();
            });
        });
    });

    describe('#_respond', function () {

        it('returns an error reply on invalid Response._respond', function (done) {

            var handler = function (request) {

                Hapi.Response._respond(null, request, function () { });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
                done();
            });
        });
    });
});
