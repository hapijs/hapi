// Load modules

var Fs = require('fs');
var Http = require('http');
var Stream = require('stream');
var Zlib = require('zlib');
var Lab = require('lab');
var Nipple = require('nipple');
var Hapi = require('../..');


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

        it('returns a reply', function (done) {

            var handler = function (request, reply) {

                reply('text').type('text/plain')
                             .charset('ISO-8859-1')
                             .ttl(1000)
                             .header('set-cookie', 'abc=123')
                             .state('sid', 'abcdefg123456')
                             .state('other', 'something', { isSecure: true })
                             .unstate('x')
                             .header('Content-Type', 'text/plain; something=something')
                             .header('vary', 'x-control')
                             .code(200);
            };

            var server = new Hapi.Server({ cors: true });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresIn: 9999 } } });
            server.state('sid', { encoding: 'base64' });
            server.state('always', { autoValue: 'present' });
            server.ext('onPostHandler', function (request, reply) {

                reply.state('test', '123');
                reply.unstate('empty');
                reply();
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.exist;
                expect(res.result).to.equal('text');
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
                expect(res.headers['content-type']).to.equal('text/plain; something=something, charset=ISO-8859-1');
                expect(res.headers['access-control-allow-origin']).to.equal('*');
                expect(res.headers['access-control-allow-credentials']).to.not.exist;
                expect(res.headers['set-cookie']).to.deep.equal(['abc=123', 'sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', "test=123", "empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT", "always=present"]);
                expect(res.headers.vary).to.equal('x-control');
                done();
            });
        });

        it('returns CORS origin', function (done) {

            var handler = function (request, reply) {

                reply('ok');
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.equal('http://test.example.com http://www.example.com');
                done();
            });
        });

        it('does not override CORS origin', function (done) {

            var handler = function (request, reply) {

                reply('ok').header('access-control-allow-origin', 'something');
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.equal('something');
                done();
            });
        });

        it('returns no CORS headers when route CORS disabled', function (done) {

            var handler = function (request, reply) {

                reply('ok');
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler, config: { cors: false } });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist;
                done();
            });
        });

        it('does not return CORS for no origin without isOriginExposed', function (done) {

            var handler = function (request, reply) {

                reply('ok');
            };

            var server = new Hapi.Server({ cors: { isOriginExposed: false, origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist;
                expect(res.headers.vary).to.equal('origin');
                done();
            });
        });

        it('hides CORS origin if no match found', function (done) {

            var handler = function (request, reply) {

                reply('ok');
            };

            var server = new Hapi.Server({ cors: { isOriginExposed: false, origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist;
                expect(res.headers.vary).to.equal('origin');
                done();
            });
        });

        it('returns matching CORS origin', function (done) {

            var handler = function (request, reply) {

                reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin without exposing full list', function (done) {

            var handler = function (request, reply) {

                reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server({ cors: { isOriginExposed: false, origin: ['http://test.example.com', 'http://www.example.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin wildcard', function (done) {

            var handler = function (request, reply) {

                reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns all CORS origins when match is disabled', function (done) {

            var handler = function (request, reply) {

                reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com'], matchOrigin: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://test.example.com http://www.example.com');
                expect(res.headers.vary).to.equal('x-test');
                done();
            });
        });

        it('returns error on created with GET', function (done) {

            var handler = function (request, reply) {

                reply().created('/something');
            };

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns an error on bad cookie', function (done) {

            var handler = function (request, reply) {

                reply('text').state(';sid', 'abcdefg123456');
            };

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.exist;
                expect(res.result.message).to.equal('An internal server error occurred');
                expect(res.headers['set-cookie']).to.not.exist;
                done();
            });
        });

        it('does not modify content-type header when charset manually set', function (done) {

            var handler = function (request, reply) {

                reply('text').type('text/plain; charset=ISO-8859-1');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/plain; charset=ISO-8859-1');
                done();
            });
        });

        it('sets Vary header with single value', function (done) {

            var handler = function (request, reply) {

                reply('ok').vary('x');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x');
                done();
            });
        });

        it('sets Vary header with multiple values', function (done) {

            var handler = function (request, reply) {

                reply('ok').vary('x').vary('y');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x,y');
                done();
            });
        });

        it('sets Vary header with *', function (done) {

            var handler = function (request, reply) {

                reply('ok').vary('*');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('leaves Vary header with * on additional values', function (done) {

            var handler = function (request, reply) {

                reply('ok').vary('*').vary('x');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('drops other Vary header values when set to *', function (done) {

            var handler = function (request, reply) {

                reply('ok').vary('x').vary('*');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('uses reply(null, result) for result', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(null, 'steve'); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('steve');
                done();
            });
        });

        it('uses reply(null, err) for err', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(null, Hapi.error.badRequest()); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('ignores result when err provided in reply(err, result)', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(Hapi.error.badRequest(), 'steve'); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('Buffer', function () {

        it('returns a reply', function (done) {

            var handler = function (request, reply) {

                reply(new Buffer('Tada1')).code(299);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('Tada1');
                expect(res.headers['content-type']).to.equal('application/octet-stream');
                done();
            });
        });
    });

    describe('Obj', function () {

        it('returns a plain response', function (done) {

            var handler = function (request, reply) {

                reply({ a: 1, b: 2 });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
                done();
            });
        });

        it('returns false', function (done) {

            var handler = function (request, reply) {

                reply(false);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('false');
                done();
            });
        });

        it('returns a formatted response', function (done) {

            var handler = function (request, reply) {

                reply({ a: 1, b: 2 });
            };

            var server = new Hapi.Server({ json: { replacer: ['a'], space: 4 } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n    \"a\": 1\n}');
                done();
            });
        });

        it('returns a response with options', function (done) {

            var handler = function (request, reply) {

                reply({ a: 1, b: 2 }).type('application/x-test').spaces(0).replacer(null);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
                expect(res.headers['content-type']).to.equal('application/x-test');
                done();
            });
        });

        it('validates response', function (done) {

            var i = 0;
            var handler = function (request, reply) {

                reply({ some: i++ ? null : 'value' });
            };

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', config: { response: { schema: { some: Hapi.types.String() } } }, handler: handler });

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

            var handler = function (request, reply) {

                reply({ some: 'value' });
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

            var handler = function (request, reply) {

                var parts = request.params.name.split('/');
                reply({ first: parts[0], last: parts[1] });
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
                expect(res.headers['vary']).to.equal('accept-encoding');
                Zlib.unzip(new Buffer(res.payload, 'binary'), function (err, result) {

                    expect(err).to.not.exist;
                    expect(result.toString()).to.equal('docall({"first":"1","last":"2"});');
                    done();
                });
            });
        });

        it('returns an JSONP response when response is a buffer', function (done) {

            var handler = function (request, reply) {

                reply(new Buffer('value'));
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

            var handler = function (request, reply) {

                reply({ some: 'value' });
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

            var handler = function (request, reply) {

                reply(new Error('boom'));
            };

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist;
                expect(res.result.message).to.equal('boom');
                done();
            });
        });

        it('emits internalError when view file for handler not found', function (done) {

            var options = {
                debug: false,
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

        var handler = function (request, reply) {

            return reply().code(299);
        };

        var server = new Hapi.Server({ cors: { credentials: true } });
        server.route({ method: 'GET', path: '/', handler: handler });

        it('returns an empty reply', function (done) {

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal(null);
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });
    });

    describe('File', function () {

        it('returns a file in the response with the correct headers', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file('../../package.json').code(499);
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.statusCode).to.equal(499);
                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file in the response with the correct headers using cwd relative paths without content-disposition header', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: './package.json' } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file in the response with the inline content-disposition header when using route config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: './' } });
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'inline' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('inline; filename=package.json');
                done();
            });
        });

        it('returns a file in the response with the attachment content-disposition header when using route config', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'attachment' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=package.json');
                done();
            });
        });

        it('returns a file in the response without the content-disposition header when using route config mode false', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: false } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.not.exist;
                done();
            });
        });

        it('returns a file with correct headers when using attachment mode', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../../package.json', { mode: 'attachment' });
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=package.json');
                done();
            });
        });

        it('returns a file with correct headers when using inline mode', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../../package.json', { mode: 'inline' });
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
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

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            server.route({ method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../../package.json' } });

            server.inject('/staticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the file function with the build-in handler config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            server.route({ method: 'GET', path: '/filefn/{file}', handler: { file: filenameFn } });

            server.inject('/filefn/index.js', function (res) {

                expect(res.payload).to.contain('./lib');
                expect(res.headers['content-type']).to.equal('application/javascript; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file in the response with the correct headers (relative path)', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: '.' } });
            var relativeHandler = function (request, reply) {

                reply.file('./package.json');
            };

            server.route({ method: 'GET', path: '/relativefile', handler: relativeHandler });

            server.inject('/relativefile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the built-in handler config (relative path)', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            server.route({ method: 'GET', path: '/relativestaticfile', handler: { file: '../../package.json' } });

            server.inject('/relativestaticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        
        it('does not cache etags', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname, etagsCacheMaxSize: 0 } });
            server.route({ method: 'GET', path: '/note', handler: { file: './file/note.txt' } });

            server.inject('/note', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Test');
                expect(res.headers.etag).to.not.exist;

                server.inject('/note', function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('Test');
                    expect(res.headers.etag).to.not.exist;
                    done();
                });
            });
        });

        it('invalidates etags when file changes', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });

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

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('returns a deflated file in the response when the request accepts deflate', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'deflate' } }, function (res) {

                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('deflate');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('returns a gzipped file using precompressed file', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/integration/file/image.png', lookupCompressed: true } } });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-type']).to.equal('image/png');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('returns a gzipped file when precompressed file not found', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/integration/file/note.txt', lookupCompressed: true } } });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('does not throw an error when adding a route with a parameter and function path', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0, { files: { relativeTo: __dirname } });
                server.route({ method: 'GET', path: '/fileparam/{path}', handler: { file: function () { } } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('Stream', function () {

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hapi.utils.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            this.push('x');
            this.push('y');
            this.push(null);
        };

        it('returns a stream reply', function (done) {

            var handler = function (request, reply) {

                reply(new TestStream()).ttl(2000);
            };

            var server = new Hapi.Server({ cors: { origin: ['test.example.com'] }, debug: false });
            server.route({ method: 'GET', path: '/stream', config: { handler: handler, cache: { expiresIn: 9999 } } });

            server.inject('/stream', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');

                server.inject({ method: 'HEAD', url: '/stream' }, function (res) {

                    expect(res.result).to.equal('');
                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                    expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                    done();
                });
            });
        });

        it('emits response event', function (done) {

            var handler = function (request, reply) {

                reply(new TestStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.on('response', function (request) {

                expect(request.url.path).to.equal('/stream');
                done();
            });

            server.inject('/stream', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
            });
        });

        it('returns a stream reply when accept-encoding is malformed', function (done) {

            var handler = function (request, reply) {

                reply(new TestStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject({ url: '/stream', headers: { 'content-encoding': '', 'accept-encoding': 't=1,' } }, function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returns a stream reply with custom response headers', function (done) {

            var handler = function (request, reply) {

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

                reply(new HeadersStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.custom).to.equal('header');
                done();
            });
        });

        it('returns a stream reply with custom response status code', function (done) {

            var handler = function (request, reply) {

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

                reply(new HeadersStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', function (res) {

                expect(res.statusCode).to.equal(201);
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

            var streamHandler = function (request, reply) {

                reply(new TimerStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist;
                done();
            });
        });

        it('returns a deflated stream reply without a content-length header when accept-encoding is deflate', function (done) {

            var streamHandler = function (request, reply) {

                reply(new TimerStream());
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist;
                done();
            });
        });

        it('returns a stream reply (created)', function (done) {

            var handler = function (request, reply) {

                reply(new TestStream()).created('/special');
            };

            var server = new Hapi.Server({ location: 'http://example.com:8080' });
            server.route({ method: 'POST', path: '/stream', handler: handler });

            server.inject({ method: 'POST', url: '/stream' }, function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal(server.settings.location + '/special');
                expect(res.headers['cache-control']).to.equal('no-cache');
                done();
            });
        });

        it('returns an error on bad state', function (done) {

            var handler = function (request, reply) {

                reply(new TestStream()).state(';sid', 'abcdefg123456');
            };

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns a broken stream reply on error issue', function (done) {

            var ErrStream = function () {

                Stream.Readable.call(this);
            };

            Hapi.utils.inherits(ErrStream, Stream.Readable);

            ErrStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                if (!this.x) {
                    this.emit('error', new Error());
                    this.x = true;
                }
            };

            var handler = function (request, reply) {

                reply(new ErrStream()).bytes(0);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('stops processing the stream when the request closes', function (done) {

            var ErrStream = function (request) {

                Stream.Readable.call(this);

                this.request = request;
            };

            Hapi.utils.inherits(ErrStream, Stream.Readable);

            ErrStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;
                this.push('here is the response');
                process.nextTick(function () {

                    self.request.raw.req.emit('close');
                    process.nextTick(function () {

                        self.push(null);
                    });
                });
            };

            var handler = function (request, reply) {

                reply(new ErrStream(request)).bytes(0);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject({ url: '/stream', headers: { 'Accept-Encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not truncate the response when stream finishes before response is done', function (done) {

            var chunkTimes = 10;
            var readTimes = 0;
            var filePath = __dirname + '/response.js';
            var responseJs = Fs.readFileSync(filePath).toString();

            var expectedBody = '';
            for (var i = 0, il = chunkTimes; i < il; ++i) {
                expectedBody += responseJs;
            }

            var streamServer = new Hapi.Server(0);
            var fileHandler = function (request, reply) {

                var fileStream = new Stream.Readable();
                fileStream._read = function (n) {

                    if (readTimes++ === chunkTimes) {
                        fileStream.push(null);
                    }
                    else {
                        fileStream.push(responseJs);
                    }
                };

                reply(fileStream);
            };
            streamServer.route({ method: 'GET', path: '/', handler: fileHandler });

            streamServer.start(function () {

                var req = Http.get('http://127.0.0.1:' + streamServer.info.port + '/', function (res) {

                    var receivedFile = '';
                    res.on('readable', function () {

                        var buffer = res.read();
                        if (buffer) {
                            receivedFile += buffer.toString();
                        }
                    });

                    res.once('end', function () {

                        expect(receivedFile).to.equal(expectedBody);
                        done();
                    });
                });

                req.on('error', function (err) {

                    expect(err).to.not.exist();
                });
            });
        });

        it('does not truncate the response when stream finishes before response is done using https', function (done) {

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
            var fileHandler = function (request, reply) {

                var fileStream = new Stream.Readable();
                fileStream._read = function (n) {

                    if (readTimes++ === chunkTimes) {

                        fileStream.push(null);
                    }
                    else {
                        fileStream.push(responseJs);
                    }
                };

                reply(fileStream);
            };
            streamServer.route({ method: 'GET', path: '/', handler: fileHandler });

            streamServer.start(function () {

                Nipple.get('https://127.0.0.1:' + streamServer.info.port, { rejectUnauthorized: false }, function (err, res, body) {

                    expect(body).to.equal(expectedBody);
                    done();
                });
            });
        });
    });

    describe('View', function () {

        var viewPath = __dirname + '/../unit/templates/valid';
        var msg = "Hello, World!";

        var handler = function (request, reply) {

            return reply.view('test', { message: msg });
        };
        var absoluteHandler = function (request, reply) {

            return reply.view(viewPath + '/test', { message: msg });
        };
        var insecureHandler = function (request, reply) {

            return reply.view('../test', { message: msg });
        };
        var nonexistentHandler = function (request, reply) {

            return reply.view('testNope', { message: msg });
        };
        var invalidHandler = function (request, reply) {

            return reply.view('badmustache', { message: msg }, { path: viewPath + '/../invalid' });
        };
        var testMultiHandlerJade = function (request, reply) {

            return reply.view('testMulti.jade', { message: "Hello World!" });
        };
        var testMultiHandlerHB = function (request, reply) {

            return reply.view('test.html', { message: "Hello World!" });
        };
        var testMultiHandlerUnknown = function (request, reply) {

            return reply.view('test', { message: "Hello World!" });
        };
        var testMultiHandlerMissing = function (request, reply) {

            return reply.view('test.xyz', { message: "Hello World!" });
        };

        var cached = 1;
        var cachedHandler = function (request, reply) {

            reply.view('test', { message: cached++ });
        };
        
        it('returns error on invalid template path', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates/invalid'
                }
            });
            
            var handler = function (request, reply) {
                
                reply.view('test', { message: 'Ohai' });
            };
            
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        describe('Default', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: viewPath
                }
            });
            server.route({ method: 'GET', path: '/views', config: { handler: handler } });
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

            it('returns response', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('<!DOCTYPE html>\n<html>\n    <head>\n        <title>test</title>\n    </head>\n    <body>\n        <div>\n    <h1>Hapi</h1>\n</div>\n\n    </body>\n</html>\n');
                    done();
                });
            });

            it('returns response with basePath and absolute path', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    basePath: '/none/shall/pass',
                    path: __dirname + '/../unit/templates',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('<!DOCTYPE html>\n<html>\n    <head>\n        <title>test</title>\n    </head>\n    <body>\n        <div>\n    <h1>Hapi</h1>\n</div>\n\n    </body>\n</html>\n');
                    done();
                });
            });

            it('returns response with layout override', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' }, { layout: 'otherLayout' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('test:<div>\n    <h1>Hapi</h1>\n</div>\n');
                    done();
                });
            });

            it('returns response with custom server layout', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: 'otherLayout'
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('test:<div>\n    <h1>Hapi</h1>\n</div>\n');
                    done();
                });
            });

            it('returns response with custom server layout and path', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    basePath: __dirname + '/../unit',
                    path: 'templates',
                    layoutPath: 'templates/layout',
                    layout: 'elsewhere'
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('test+<div>\n    <h1>Hapi</h1>\n</div>\n');
                    done();
                });
            });

            it('errors on missing layout', function (done) {

                var layoutServer = new Hapi.Server({ debug: false });
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: 'missingLayout'
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('errors on invalid layout', function (done) {

                var layoutServer = new Hapi.Server({ debug: false });
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: '../invalidLayout'
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns response without layout', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('valid/test', { title: 'test', message: 'Hapi' }, { layout: false });
                };

                layoutServer.route({ method: 'GET', path: '/', handler: handler });

                layoutServer.inject('/', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('<div>\n    <h1>Hapi</h1>\n</div>\n');
                    done();
                });
            });

            it('returns error on layoutKeyword conflict', function (done) {

                var layoutServer = new Hapi.Server({ debug: false });
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates/valid',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('test', { message: msg, content: 'fail' });
                };

                layoutServer.route({ method: 'GET', path: '/conflict', handler: handler });

                layoutServer.inject('/conflict', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

                var layoutServer = new Hapi.Server({ debug: false });
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates/valid',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('test', { message: msg }, { path: viewPath + '/../invalid' });
                };

                layoutServer.route({ method: 'GET', path: '/abspath', handler: handler });

                layoutServer.inject('/abspath', function (res) {

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
                    debug: false,
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

        var handler = function (request, reply) {

            if (!request.query.x) {
                return reply('Please wait while we send your elsewhere').redirect('example');
            }

            if (request.query.x === 'verbose') {
                return reply('We moved!').redirect().location('examplex');
            }

            if (request.query.x === '302') {
                return reply().redirect('example').temporary().rewritable();
            }

            if (request.query.x === '307') {
                return reply().redirect('example').temporary().rewritable(false);
            }

            if (request.query.x === '301') {
                return reply().redirect('example').permanent().rewritable();
            }

            if (request.query.x === '308') {
                return reply().redirect('example').permanent().rewritable(false);
            }

            if (request.query.x === '302f') {
                return reply().redirect('example').rewritable().temporary();
            }

            if (request.query.x === '307f') {
                return reply().redirect('example').rewritable(false).temporary();
            }

            if (request.query.x === '301f') {
                return reply().redirect('example').rewritable().permanent();
            }

            if (request.query.x === '308f') {
                return reply().redirect('example').rewritable(false).permanent();
            }
        };

        var server = new Hapi.Server(0, { debug: false });
        server.route({ method: 'GET', path: '/redirect', config: { handler: handler } });

        before(function (done) {

            server.start(done);
        });

        it('returns a redirection reply', function (done) {

            server.inject('http://example.org/redirect', function (res) {

                expect(res.result).to.exist;
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

        it('returns a reply with manual end', function (done) {

            var handler = function (request, reply) {

                request.raw.res.end();
                reply.close({ end: false });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('returns a reply with auto end', function (done) {

            var handler = function (request, reply) {

                reply.close();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });
    });
});
