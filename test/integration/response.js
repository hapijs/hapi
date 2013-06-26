// Load modules

var Fs = require('fs');
var Http = require('http');
var Lab = require('lab');
var Request = require('request');
var Stream = require('stream');
var Zlib = require('zlib');
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

                request.reply('text\0!')
                             .type('text/plain')
                             .encoding('ascii')
                             .ttl(1000)
                             .state('sid', 'abcdefg123456')
                             .state('other', 'something', { isSecure: true })
                             .unstate('x')
                             .header('Content-Type', 'text/plain; something=something')
                             .code(200);
            };

            var handlerBound = function () {

                this.reply('Tada');
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com', 'www.example.com'] } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresIn: 9999 } } });
            server.route({ method: 'GET', path: '/bound', config: { handler: handlerBound } });
            server.state('sid', { encoding: 'base64' });
            server.state('always', { autoValue: 'present' });
            server.ext('onPostHandler', function (request, next) {

                request.setState('test', '123');
                request.clearState('empty');
                next();
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.exist;
                expect(res.payload).to.equal('text !');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com www.example.com');
                expect(res.headers['access-control-allow-credentials']).to.not.exist;
                expect(res.headers['set-cookie']).to.deep.equal(['sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', "test=123", "empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT", "always=present"]);

                server.inject({ url: '/bound', headers: { origin: 'www.example.com' } }, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.equal('Tada');
                    expect(res.headers['access-control-allow-origin']).to.equal('www.example.com');
                    done();
                });
            });
        });

        it('returns an error on bad cookie', function (done) {

            var handler = function (request) {

                request.reply('text').state(';sid', 'abcdefg123456');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

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

                this.reply(new Buffer('Tada1')).code(299);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('Tada1');
                done();
            });
        });
    });

    describe('Obj', function () {

        it('validates response', function (done) {

            var i = 0;
            var handler = function (request) {

                request.reply({ some: i++ ? null : 'value' });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { validate: { response: { schema: { some: Hapi.types.String() } } }, handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('{"some":"value"}');

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        it('returns an JSONP response', function (done) {

            var handler = function (request) {

                request.reply({ some: 'value' });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', function (res) {

                expect(res.payload).to.equal('me({"some":"value"});');
                expect(res.headers['content-length']).to.equal(21);
                done();
            });
        });

        it('returns an JSONP response with compression', function (done) {

            var handler = function () {

                var parts = this.params.name.split('/');
                this.reply({ first: parts[0], last: parts[1] });
            };

            var server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/user/{name*2}',
                config: {
                    handler: handler,
                    jsonp: 'callback'
                }
            });

            server.inject({ url: '/user/1/2?callback=docall', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('gzip');
                Zlib.unzip(res.rawPayload, function (err, result) {

                    expect(err).to.not.exist;
                    expect(result.toString()).to.equal('docall({"first":"1","last":"2"});');
                    done();
                });
            });
        });

        it('returns an JSONP response when response is a buffer', function (done) {

            var handler = function (request) {

                request.reply(new Buffer('value'));
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', function (res) {

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

            server.inject('/?callback=me*', function (res) {

                expect(res.result).to.exist;
                expect(res.result.message).to.equal('Invalid JSONP parameter value');
                done();
            });
        });
    });

    describe('Error', function () {

        it('returns an error reply', function (done) {

            var handler = function (request) {

                request.reply(new Error('boom'));
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

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

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
            });
        });

        it('emits internalError when view file for handler not found', function (done) {

            var options = {
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname
                }
            };

            var server = new Hapi.Server(options);

            server.once('internalError', function (request, err) {

                expect(err).to.exist;
                expect(err.message).to.contain('View file not found');
                done();
            });

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'noview' } });

            server.inject('/hello', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
            });
        });
    });

    describe('Empty', function () {

        var handler = function (request) {

            return request.reply().code(299);
        };

        var server = new Hapi.Server({ cors: { credentials: true } });
        server.route([
            { method: 'GET', path: '/', handler: handler },
        ]);

        it('returns an empty reply', function (done) {

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('');
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });
    });

    describe('File', function () {

        it('returns a file in the response with the correct headers', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file in the response with the correct headers using cwd relative paths without content-disposition header', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'cwd' } });
            server.route({ method: 'GET', path: '/', handler: { file: './package.json' } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file in the response with the inline content-disposition header when using route config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'cwd' } });
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'inline' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('inline; filename=package.json');
                done();
            });
        });

        it('returns a file in the response with the attachment content-disposition header when using route config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'cwd' } });
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'attachment' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=package.json');
                done();
            });
        });

        it('returns a file in the response without the content-disposition header when using route config mode false', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'cwd' } });
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: false } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file with correct headers when using attachment mode', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.response.File(__dirname + '/../../package.json', { mode: 'attachment' }));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=package.json');
                done();
            });
        });

        it('returns a file with correct headers when using inline mode', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.response.File(__dirname + '/../../package.json', { mode: 'inline' }));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('inline; filename=package.json');
                done();
            });
        });

        it('returns a 404 when the file is not found', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: '/no/such/path/x1' } });

            server.route({ method: 'GET', path: '/filenotfound', handler: { file: 'nopes' } });

            server.inject('/filenotfound', function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('returns a 403 when the file is a directory', function (done) {

            var server = new Hapi.Server();

            server.route({ method: 'GET', path: '/filefolder', handler: { file: 'examples' } });

            server.inject('/filefolder', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        var filenameFn = function (request) {

            return '../../' + request.params.file;
        };

        it('returns a file using the build-in handler config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../../package.json' } });

            server.inject('/staticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the file function with the build-in handler config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/filefn/{file}', handler: { file: filenameFn } });

            server.inject('/filefn/index.js', function (res) {

                expect(res.payload).to.contain('./lib');
                expect(res.headers['content-type']).to.equal('application/javascript');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file in the response with the correct headers (relative path)', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var relativeHandler = function (request) {

                request.reply(new Hapi.response.File('./package.json'));
            };

            server.route({ method: 'GET', path: '/relativefile', handler: relativeHandler });

            server.inject('/relativefile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the built-in handler config (relative path)', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            server.route({ method: 'GET', path: '/relativestaticfile', handler: { file: '../../package.json' } });

            server.inject('/relativestaticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('invalidates etags when file changes', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });

            server.route({ method: 'GET', path: '/note', handler: { file: './file/note.txt' } });

            // No etag, never requested

            server.inject('/note', function (res1) {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result).to.equal('Test');
                expect(res1.headers.etag).to.not.exist;

                // No etag, previously requested

                server.inject('/note', function (res2) {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result).to.equal('Test');
                    expect(res2.headers.etag).to.exist;

                    var etag1 = res2.headers.etag;

                    // etag

                    server.inject({ url: '/note', headers: { 'if-none-match': etag1 } }, function (res3) {

                        expect(res3.statusCode).to.equal(304);

                        var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                        Fs.writeSync(fd, new Buffer('Test'), 0, 4);
                        Fs.closeSync(fd);

                        // etag after file modified, content unchanged

                        server.inject({ url: '/note', headers: { 'if-none-match': etag1 } }, function (res4) {

                            expect(res4.statusCode).to.equal(200);
                            expect(res4.result).to.equal('Test');
                            expect(res4.headers.etag).to.not.exist;

                            // No etag, previously requested

                            server.inject({ url: '/note' }, function (res5) {

                                expect(res5.statusCode).to.equal(200);
                                expect(res5.result).to.equal('Test');
                                expect(res5.headers.etag).to.exist;

                                var etag2 = res5.headers.etag;
                                expect(etag1).to.equal(etag2);

                                var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                                Fs.writeSync(fd, new Buffer('Test1'), 0, 5);
                                Fs.closeSync(fd);

                                // etag after file modified, content changed

                                server.inject({ url: '/note', headers: { 'if-none-match': etag2 } }, function (res6) {

                                    expect(res6.statusCode).to.equal(200);
                                    expect(res6.result).to.equal('Test1');
                                    expect(res6.headers.etag).to.not.exist;

                                    // No etag, previously requested

                                    server.inject('/note', function (res7) {

                                        expect(res7.statusCode).to.equal(200);
                                        expect(res7.result).to.equal('Test1');
                                        expect(res7.headers.etag).to.exist;

                                        var etag3 = res7.headers.etag;
                                        expect(etag1).to.not.equal(etag3);

                                        var fd = Fs.openSync(__dirname + '/file/note.txt', 'w');
                                        Fs.writeSync(fd, new Buffer('Test'), 0, 4);
                                        Fs.closeSync(fd);

                                        // No etag, content restored

                                        server.inject('/note', function (res8) {

                                            expect(res8.statusCode).to.equal(200);
                                            expect(res8.result).to.equal('Test');

                                            // No etag, previously requested

                                            server.inject('/note', function (res9) {

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

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../../package.json' } });

            server.inject('/file', function (res1) {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } }, function (res2) {

                    expect(res2.statusCode).to.equal(304);
                    done();
                });
            });
        });

        it('returns a gzipped file in the response when the request accepts gzip', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('returns a deflated file in the response when the request accepts deflate', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: 'routes' } });
            var handler = function (request) {

                request.reply(new Hapi.response.File(__dirname + '/../../package.json'));
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'deflate' } }, function (res) {

                expect(res.headers['content-type']).to.equal('application/json');
                expect(res.headers['content-encoding']).to.equal('deflate');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
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
        server.route({ method: 'GET', path: '/redirect/{path*}', handler: { directory: { path: './', index: true, listing: true, redirectToSlash: true } } });

        it('returns a 403 when no index exists and listing is disabled', function (done) {

            server.inject('/directory/', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns a 403 when requesting a path containing \'..\'', function (done) {

            server.inject('/directory/..', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns a 404 when requesting an unknown file within a directory', function (done) {

            server.inject('/directory/xyz', function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('returns a file when requesting a file from the directory', function (done) {

            server.inject('/directory/response.js', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('hapi');
                done();
            });
        });

        it('returns a file when requesting a file from multi directory setup', function (done) {

            server.inject('/multiple/unit/response/directory.js', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('no_such_path');
                done();
            });
        });

        it('returns the correct file when requesting a file from a child directory', function (done) {

            server.inject('/directory/directory/index.html', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('test');
                done();
            });
        });

        it('returns the correct listing links when viewing top level path', function (done) {

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('href="/response.js"');
                done();
            });
        });

        it('doesn\'t contain any double / when viewing sub path listing', function (done) {

            server.inject('/showindex/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.not.contain('//');
                done();
            });
        });

        it('has the correct link to sub folders when inside of a sub folder listing', function (done) {

            server.inject('/showindex/directory/subdir', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('href="/showindex/directory/subdir/subsubdir"');
                done();
            });
        });

        it('returns a 403 when index and listing are disabled', function (done) {

            server.route({ method: 'GET', path: '/directoryx/{path*}', handler: { directory: { path: '../../', index: false } } });

            server.inject('/directoryx/', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        server.route({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../../', listing: true } } });

        it('returns a list of files when listing is enabled', function (done) {

            server.inject('/directorylist/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('package.json');
                done();
            });
        });

        it('returns a list of files for subdirectory', function (done) {

            server.inject('/directorylist/test', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('integration');
                done();
            });
        });

        it('returns a list of files when listing is enabled and index disabled', function (done) {

            server.route({ method: 'GET', path: '/directorylistx/{path*}', handler: { directory: { path: '../../', listing: true, index: false } } });

            server.inject('/directorylistx/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('package.json');
                done();
            });
        });

        server.route({ method: 'GET', path: '/directoryIndex/{path*}', handler: { directory: { path: './directory/' } } });

        it('returns the index when found', function (done) {

            server.inject('/directoryIndex/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('<p>test</p>');
                done();
            });
        });

        it('returns a 500 when index.html is a directory', function (done) {

            server.inject('/directoryIndex/invalid', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns the correct file when using a fn directory handler', function (done) {

            var directoryFn = function (request) {

                return '../../lib';
            };

            server.route({ method: 'GET', path: '/directoryfn/{path?}', handler: { directory: { path: directoryFn } } });

            server.inject('/directoryfn/defaults.js', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('export');
                done();
            });
        });

        it('returns listing with hidden files when hidden files should be shown', function (done) {

            server.inject('/showhidden/', function (res) {

                expect(res.payload).to.contain('.hidden');
                done();
            });
        });

        it('returns listing without hidden files when hidden files should not be shown', function (done) {

            server.inject('/noshowhidden/', function (res) {

                expect(res.payload).to.not.contain('.hidden');
                expect(res.payload).to.contain('response.js');
                done();
            });
        });

        it('returns a 404 response when requesting a hidden file when showHidden is disabled', function (done) {

            server.inject('/noshowhidden/.hidden', function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('returns a file when requesting a hidden file when showHidden is enabled', function (done) {

            server.inject('/showhidden/.hidden', function (res) {

                expect(res.payload).to.contain('test');
                done();
            });
        });

        it('redirects to the same path with / appended if asking for a directory', function (done) {

            server.inject('http://example.com/redirect/directory/subdir', function (res) {

                expect(res.statusCode).to.equal(302);
                expect(res.headers.location).to.equal('http://example.com/redirect/directory/subdir/');
                done();
            });
        });
    });

    describe('Stream', function () {

        var TestStream = function (request, issue) {

            Stream.Readable.call(this);

            this.issue = issue;
            this.request = request;
        };

        Hapi.utils.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            var self = this;

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            switch (this.issue) {
                case 'error':
                    if (!this.x) {
                        this.emit('error', new Error());
                        this.x = true;
                    }
                    break;

                case 'closes':
                    this.push('here is the response');
                    process.nextTick(function () {
                        self.request.raw.req.emit('close');
                        process.nextTick(function () {
                            self.push(null);
                        });
                    });
                    break;

                default:
                    this.push('x');
                    this.push('y');
                    this.push(null);
                    break;
            }
        };

        var handler = function (request) {

            request.reply(new TestStream(request, request.params.issue))
                         .bytes(request.params.issue ? 0 : 1)
                         .ttl(2000);
        };

        var handler2 = function (request) {

            var HeadersStream = function () {

                Stream.Readable.call(this);
                this.headers = { custom: 'header' };
            };

            Hapi.utils.inherits(HeadersStream, Stream.Readable);

            HeadersStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('hello');
                this.push(null);
            };

            request.reply(new Hapi.response.Stream(new HeadersStream()));
        };

        var handler3 = function (request) {

            request.reply(new TestStream(request, request.params.issue))
                         .created('/special')
                         .bytes(request.params.issue ? 0 : 1)
                         .ttl(3000);
        };

        var handler4 = function (request) {

            request.reply(new TestStream(request))
                         .state(';sid', 'abcdefg123456');
        };

        var handler5 = function (request) {

            var HeadersStream = function () {

                Stream.Readable.call(this);
                this.statusCode = 201;
            };

            Hapi.utils.inherits(HeadersStream, Stream.Readable);

            HeadersStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('hello');
                this.push(null);
            };

            request.reply(new Hapi.response.Stream(new HeadersStream()));
        };

        var handler6 = function (request) {

            var oldMode = new TestStream(request);
            oldMode.pause();
            request.reply(oldMode);
        };

        var server = new Hapi.Server({ cors: { origin: ['test.example.com'] }, location: 'http://example.com:8080' });
        server.route({ method: 'GET', path: '/stream/{issue?}', config: { handler: handler, cache: { expiresIn: 9999 } } });
        server.route({ method: 'POST', path: '/stream/{issue?}', config: { handler: handler } });
        server.route({ method: 'GET', path: '/stream2', config: { handler: handler2 } });
        server.route({ method: 'GET', path: '/stream3', config: { handler: handler3, cache: { expiresIn: 9999 } } });
        server.route({ method: 'GET', path: '/stream4', config: { handler: handler4 } });
        server.route({ method: 'GET', path: '/stream5', config: { handler: handler5 } });
        server.route({ method: 'GET', path: '/stream6', config: { handler: handler6 } });

        it('returns a stream reply', function (done) {

            server.inject('/stream/', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a stream reply when accept-encoding is malformed', function (done) {

            server.inject({ url: '/stream/', headers: { 'content-encoding': '', 'accept-encoding': 't=1,' } }, function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns a stream reply with custom response headers', function (done) {

            server.inject('/stream2', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.custom).to.equal('header');
                done();
            });
        });

        it('returns a stream reply with custom response status code', function (done) {

            server.inject('/stream5', function (res) {

                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('returns a stream reply using old style stream interface', function (done) {

            server.inject('/stream6', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        var TimerStream = function () {

            Stream.Readable.call(this);
        };

        Hapi.utils.inherits(TimerStream, Stream.Readable);

        TimerStream.prototype._read = function (size) {

            var self = this;

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            setTimeout(function () {

                self.push('hi');
                self.push(null);
            }, 5);
        };

        it('returns a gzipped stream reply without a content-length header when accept-encoding is gzip', function (done) {

            var streamHandler = function (request) {

                request.reply(new TimerStream());
            };

            var server1 = new Hapi.Server();
            server1.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server1.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist;
                done();
            });
        });

        it('returns a deflated stream reply without a content-length header when accept-encoding is deflate', function (done) {

            var streamHandler = function (request) {

                request.reply(new TimerStream());
            };

            var server1 = new Hapi.Server();
            server1.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server1.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist;
                done();
            });
        });

        it('returns a stream reply (created)', function (done) {

            server.inject('/stream3', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal(server.settings.location + '/special');
                expect(res.headers['cache-control']).to.equal('no-cache');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                done();
            });
        });

        it('returns an error on bad state', function (done) {

            server.inject('/stream4', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns a broken stream reply on error issue', function (done) {

            server.inject('/stream/error', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('stops processing the stream when the request closes', function (done) {

            server.inject({ url: '/stream/closes', headers: { 'Accept-Encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('doesn\'t truncate the response when stream finishes before response is done', function (done) {

            var chunkTimes = 10;
            var readTimes = 0;
            var filePath = __dirname + '/response.js';
            var responseJs = Fs.readFileSync(filePath).toString();

            var expectedBody = '';
            for (var i = 0, il = chunkTimes; i < il; ++i) {
                expectedBody += responseJs;
            }

            var streamServer = new Hapi.Server(0);
            var fileHandler = function (request) {

                var fileStream = new Stream.Readable();
                fileStream._read = function (n) {

                    if (readTimes++ === chunkTimes) {

                        fileStream.push(null);
                    }
                    else {
                        fileStream.push(responseJs);
                    }
                };

                request.reply(fileStream);
            };
            streamServer.route({ method: 'GET', path: '/', handler: fileHandler });

            streamServer.start(function () {

                Http.get('http://127.0.0.1:' + streamServer.info.port + '/', function (res) {

                    var receivedFile = '';
                    res.on('readable', function () {

                        receivedFile += res.read().toString();
                    });

                    res.once('end', function () {

                        expect(receivedFile).to.equal(expectedBody);
                        done();
                    });
                }).on('error', function (err) {

                    expect(err).to.not.exist();
                });
            });
        });

        it('doesn\'t truncate the response when stream finishes before response is done using https', function (done) {

            var chunkTimes = 10;
            var readTimes = 0;
            var filePath = __dirname + '/response.js';
            var responseJs = Fs.readFileSync(filePath).toString();
            var tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOwIBAAJBANysie374iGH54SVcmM4vb+CjN4nVVCmL6af9XOUxTqq/50CBn+Z\nZol0XDG+OK55HTOht4CsQrAXey69ZTxgUMcCAwEAAQJAX5t5XtxkiraA/hZpqsdo\nnlKHibBs7DY0KvLeuybXlKS3ar/0Uz0OSJ1oLx3d0KDSmcdAIrfnyFuBNuBzb3/J\nEQIhAPX/dh9azhztRppR+9j8CxDg4ixJ4iZbHdK0pfnY9oIFAiEA5aV8edK31dkF\nfBXoqlOvIeuNc6WBZrYjUNspH8M+BVsCIQDZF3U6/nve81bXYXqMZwGtB4kR5LH7\nf3W2OU4wS9RfsQIhAJkNB76xX3AYqX0fpOcPyuLSeH2gynNH5JWY2vmeSBGNAiAm\nLon4E3M/IrVVvpxGRFOazKlgIsQFGAaoylDrRFYgBA==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIB0TCCAXugAwIBAgIJANGtTMK5HBUIMA0GCSqGSIb3DQEBBQUAMEQxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UECgwJaGFwaSB0ZXN0MRQwEgYDVQQD\nDAtleGFtcGxlLmNvbTAeFw0xMzA0MDQxNDQ4MDJaFw0yMzA0MDIxNDQ4MDJaMEQx\nCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UECgwJaGFwaSB0ZXN0MRQw\nEgYDVQQDDAtleGFtcGxlLmNvbTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQDcrInt\n++Ihh+eElXJjOL2/gozeJ1VQpi+mn/VzlMU6qv+dAgZ/mWaJdFwxvjiueR0zobeA\nrEKwF3suvWU8YFDHAgMBAAGjUDBOMB0GA1UdDgQWBBQBOiF6iL2PI4E6PBj071Dh\nAiQOGjAfBgNVHSMEGDAWgBQBOiF6iL2PI4E6PBj071DhAiQOGjAMBgNVHRMEBTAD\nAQH/MA0GCSqGSIb3DQEBBQUAA0EAw8Y2rpM8SUQXjgaJJmFXrfEvnl/he7q83K9W\n9Sr/QLHpCFxunWVd8c0wz+b8P/F9uW2V4wUf5NWj1UdHMCd6wQ==\n-----END CERTIFICATE-----\n'
            };

            var expectedBody = '';
            for (var i = 0, il = chunkTimes; i < il; ++i) {
                expectedBody += responseJs;
            }

            var streamServer = new Hapi.Server(0, { tls: tlsOptions });
            var fileHandler = function (request) {

                var fileStream = new Stream.Readable();
                fileStream._read = function (n) {

                    if (readTimes++ === chunkTimes) {

                        fileStream.push(null);
                    }
                    else {
                        fileStream.push(responseJs);
                    }
                };

                request.reply(fileStream);
            };
            streamServer.route({ method: 'GET', path: '/', handler: fileHandler });

            streamServer.start(function () {

                Request({ url: 'https://127.0.0.1:' + streamServer.info.port, rejectUnauthorized: false }, function (err, res, body) {

                    expect(body).to.equal(expectedBody);
                    done();
                });
            });
        });
    });

    describe('Cached', function () {

        it('returns a cached reply', function (done) {

            var cacheHandler = function (request) {

                request.reply({ status: 'cached' });
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/cache', config: { handler: cacheHandler, cache: { mode: 'server+client', expiresIn: 5000 } } });

            server.start(function () {

                server.inject('/cache', function (res1) {

                    expect(res1.result).to.exist;
                    expect(res1.result.status).to.equal('cached');

                    server.inject('/cache', function (res2) {

                        expect(res2.result).to.deep.equal('{"status":"cached"}');
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

            return request.reply.view('test', { message: msg });
        };
        var handlerDirect = function (request) {

            return request.reply(request.generateView('test', { message: msg }));
        };
        var absoluteHandler = function (request) {

            return request.reply.view(viewPath + '/test', { message: msg });
        };
        var insecureHandler = function (request) {

            return request.reply.view('../test', { message: msg });
        };
        var nonexistentHandler = function (request) {

            return request.reply.view('testNope', { message: msg });
        };
        var invalidHandler = function (request) {

            return request.reply.view('badmustache', { message: msg }, { path: viewPath + '/../invalid' });
        };
        var layoutConflictHandler = function (request) {

            return request.reply.view('test', { message: msg, content: 'fail' });
        };
        var layoutErrHandler = function (request) {

            return request.reply.view('test', { message: msg }, { path: viewPath + '/../invalid' });
        };
        var testMultiHandlerJade = function (request) {

            return request.reply.view('testMulti.jade', { message: "Hello World!" });
        };
        var testMultiHandlerHB = function (request) {

            return request.reply.view('test.html', { message: "Hello World!" });
        };
        var testMultiHandlerUnknown = function (request) {

            return request.reply.view('test', { message: "Hello World!" });
        };
        var testMultiHandlerMissing = function (request) {

            return request.reply.view('test.xyz', { message: "Hello World!" });
        };

        describe('Default', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: { 'html': 'handlebars' },
                    path: viewPath
                }
            });
            server.route({ method: 'GET', path: '/views', config: { handler: handler } });
            server.route({ method: 'GET', path: '/views/direct', config: { handler: handlerDirect } });
            server.route({ method: 'GET', path: '/views/abspath', config: { handler: absoluteHandler } });
            server.route({ method: 'GET', path: '/views/insecure', config: { handler: insecureHandler } });
            server.route({ method: 'GET', path: '/views/nonexistent', config: { handler: nonexistentHandler } });
            server.route({ method: 'GET', path: '/views/invalid', config: { handler: invalidHandler } });

            it('returns a compiled Handlebars template reply', function (done) {

                server.inject('/views', function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.have.string(msg);
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });

            it('returns a compiled Handlebars template reply (direct reply)', function (done) {

                server.inject('/views/direct', function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.have.string(msg);
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });

            it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

                server.inject('/views/abspath', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if path given includes ../ and allowInsecureAccess is false (by default)', function (done) {

                server.inject('/views/insecure', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if template does not exist', function (done) {

                server.inject('/views/nonexistent', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error if engine.compile throws', function (done) {

                server.inject('/views/invalid', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        describe('Layout', function (done) {

            var layoutServer = new Hapi.Server();
            layoutServer.views({
                engines: { 'html': 'handlebars' },
                path: viewPath,
                layout: true
            });
            layoutServer.route({ method: 'GET', path: '/layout/conflict', config: { handler: layoutConflictHandler } });
            layoutServer.route({ method: 'GET', path: '/layout/abspath', config: { handler: layoutErrHandler } });

            it('returns error on layoutKeyword conflict', function (done) {

                layoutServer.inject('/layout/conflict', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

                layoutServer.inject('/layout/abspath', function (res) {

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
                                engines: { 'html': 'handlebars' },
                                path: viewPath
                            }
                        });
                        testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                        testServer.inject('/handlebars', function (res) {

                            expect(res.result).to.exist;
                            expect(res.statusCode).to.equal(200);
                            testServer.inject('/handlebars', function (res) {

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
                            engines: { 'html': 'handlebars' },
                            path: viewPath,
                            isCached: true
                        }
                    });
                    testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                    testServer.inject('/handlebars', function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        testServer.inject('/handlebars', function (res) {

                            expect(res.result).to.exist;
                            expect(res.statusCode).to.equal(200);
                            done();
                        });
                    });
                });

                it('should not throw if global cache disabled', function (done) {

                    var testServer = new Hapi.Server({
                        views: {
                            engines: { 'html': 'handlebars' },
                            path: viewPath,
                            isCached: false
                        }
                    });
                    testServer.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                    testServer.inject('/handlebars', function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });
            });

            describe('General', function () {

                it('should throw if view module not found', function (done) {

                    var fn = function () {

                        var failServer = new Hapi.Server({
                            views: {
                                path: viewPath,
                                engines: {
                                    'html': 'handlebars',
                                    'jade': 'jade',
                                    'hbar': {
                                        module: require('handlebars'),
                                        compile: function (engine) { return engine.compile; }
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
                        engines: {
                            html: {
                                module: 'handlebars',
                                path: viewPath
                            }
                        }
                    }
                });

                server.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });

                it('should render handlebars template', function (done) {

                    server.inject('/handlebars', function (res) {

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
                            'html': 'handlebars',
                            'jade': 'jade',
                            'hbar': {
                                module: {
                                    compile: function (engine) { return engine.compile; }
                                }
                            }
                        }
                    }
                });
                server.route({ method: 'GET', path: '/jade', config: { handler: testMultiHandlerJade } });
                server.route({ method: 'GET', path: '/handlebars', config: { handler: testMultiHandlerHB } });
                server.route({ method: 'GET', path: '/unknown', config: { handler: testMultiHandlerUnknown } });
                server.route({ method: 'GET', path: '/missing', config: { handler: testMultiHandlerMissing } });

                it('should render jade template', function (done) {

                    server.inject('/jade', function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });

                it('should render handlebars template', function (done) {

                    server.inject('/handlebars', function (res) {

                        expect(res.result).to.exist;
                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });

                it('should return 500 on unknown extension', function (done) {

                    server.inject('/unknown', function (res) {

                        expect(res.statusCode).to.equal(500);
                        done();
                    });
                });

                it('should return 500 on missing extension engine', function (done) {

                    server.inject('/missing', function (res) {

                        expect(res.statusCode).to.equal(500);
                        done();
                    });
                });
            });
        });
    });

    describe('Redirection', function () {

        var handler = function (request) {

            if (!request.query.x) {
                return request.reply.redirect('example');
            }

            if (request.query.x === 'verbose') {
                return request.reply.redirect().uri('examplex').message('We moved!');
            }

            if (request.query.x === '302') {
                return request.reply.redirect('example').temporary().rewritable();
            }

            if (request.query.x === '307') {
                return request.reply.redirect('example').temporary().rewritable(false);
            }

            if (request.query.x === '301') {
                return request.reply.redirect('example').permanent().rewritable();
            }

            if (request.query.x === '308') {
                return request.reply.redirect('example').permanent().rewritable(false);
            }

            if (request.query.x === '302f') {
                return request.reply.redirect('example').rewritable().temporary();
            }

            if (request.query.x === '307f') {
                return request.reply.redirect('example').rewritable(false).temporary();
            }

            if (request.query.x === '301f') {
                return request.reply.redirect('example').rewritable().permanent();
            }

            if (request.query.x === '308f') {
                return request.reply.redirect('example').rewritable(false).permanent();
            }
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/redirect', config: { handler: handler } });

        before(function (done) {

            server.start(done);
        });

        it('returns a redirection reply', function (done) {

            server.inject('http://example.org/redirect', function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('You are being redirected...');
                expect(res.headers.location).to.equal('http://example.org/example');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a redirection reply using verbose call', function (done) {

            server.inject('/redirect?x=verbose', function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('We moved!');
                expect(res.headers.location).to.equal('http://0.0.0.0:' + server.info.port + '/examplex');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 301 redirection reply', function (done) {

            server.inject('/redirect?x=301', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply', function (done) {

            server.inject('/redirect?x=302', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply', function (done) {

            server.inject('/redirect?x=307', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply', function (done) {

            server.inject('/redirect?x=308', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 301 redirection reply (reveresed methods)', function (done) {

            server.inject('/redirect?x=301f', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply (reveresed methods)', function (done) {

            server.inject('/redirect?x=302f', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply (reveresed methods)', function (done) {

            server.inject('/redirect?x=307f', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply (reveresed methods)', function (done) {

            server.inject('/redirect?x=308f', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });
    });

    describe('Closed', function () {

        it('returns a reply', function (done) {

            var handler = function () {

                this.raw.res.end();
                this.reply.close();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });
    });

    describe('Extension', function () {

        it('returns a reply using custom response without _prepare', function (done) {

            var handler = function () {

                var custom = {
                    isHapiResponse: true,
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

            server.inject('/', function (res) {

                expect(res.result).to.equal('Hello World');
                done();
            });
        });

        it('returns an internal error on error response loop', function (done) {

            var handler = function () {

                var custom = {
                    isHapiResponse: true,
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

            server.inject('/', function (res) {

                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns an error on infinite _prepare loop', function (done) {

            var handler = function () {

                var custom = {
                    isHapiResponse: true,
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

            server.inject('/', function (res) {

                expect(res.result.code).to.equal(500);
                done();
            });
        });
    });

    describe('#_respond', function () {

        it('returns an error reply on invalid Response._respond', function (done) {

            var handler = function (request) {

                Hapi.response._respond(null, request, function () { });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
                done();
            });
        });
    });
});
