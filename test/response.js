// Load modules

var Fs = require('fs');
var Os = require('os');
var Http = require('http');
var Stream = require('stream');
var Zlib = require('zlib');
var ChildProcess = require('child_process');
var Crypto = require('crypto');
var Path = require('path');
var Lab = require('lab');
var Hoek = require('hoek');
var Joi = require('joi');
var Nipple = require('nipple');
var Hapi = require('..');
var Response = require('../lib/response');
var Payload = require('../lib/response/payload');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


internals.uniqueFilename = function (path) {

    var name = [Date.now(), process.pid, Crypto.randomBytes(8).toString('hex')].join('-');
    return Path.join(path, name);
};


describe('Response', function () {

    it('returns last known error on error response loop', function (done) {

        var Custom = function (request) {

            Response.Plain.call(this, request, 'blow');
        };

        Hoek.inherits(Custom, Response.Plain);

        Custom.prototype._marshall = function (request, callback) {

            callback(Hapi.error.badRequest());
        };

        var handler = function (request, reply) {

            reply.state('bad', {});
            reply(new Custom(request));
        };

        var server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', config: { handler: handler } });

        server.inject('/', function (res) {

            expect(res.result.statusCode).to.equal(400);
            done();
        });
    });

    it('returns null', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(null, null); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            done();
        });
    });

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
                             .header('combo', 'o')
                             .header('combo', 'k', { append: true, separator: '-' })
                             .header('combo', 'bad', { override: false })
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
                expect(res.headers['access-control-allow-methods']).to.equal('GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
                expect(res.headers['set-cookie']).to.deep.equal(['abc=123', 'sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', "test=123", "empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT", "always=present"]);
                expect(res.headers.vary).to.equal('x-control');
                expect(res.headers.combo).to.equal('o-k');
                done();
            });
        });

        it('overrides cache-control with ttl', function (done) {

            var handler = function (request, reply) {

                reply('text').ttl(1000)
                             .header('cache-control', 'none');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate');
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

        it('returns CORS without origin', function (done) {

            var handler = function (request, reply) {

                reply('ok');
            };

            var server = new Hapi.Server({ cors: { origin: [] } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist;
                expect(res.headers['access-control-allow-methods']).to.equal('GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
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

                reply('Tada').header('vary', 'x-test');
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

                reply('Tada').header('vary', 'x-test');
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

        it('returns matching CORS origin wildcard when more than one wildcard', function (done) {

            var handler = function (request, reply) {

                reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server({ cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.b.com', 'http://*.a.com'] } });
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

                reply('Tada').header('vary', 'x-test');
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

        it('does not set security headers by default', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist;
                expect(res.headers['x-frame-options']).to.not.exist;
                expect(res.headers['x-xss-protection']).to.not.exist;
                expect(res.headers['x-download-options']).to.not.exist;
                expect(res.headers['x-content-type-options']).to.not.exist;
                done();
            });
        });

        it('returns default security headers when security is true', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: true });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });
        });

        it('does not set default security headers when the route sets security false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var config = {
                security: false
            };

            var server = new Hapi.Server({ security: true });
            server.route({ method: 'GET', path: '/', handler: handler, config: config });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist;
                expect(res.headers['x-frame-options']).to.not.exist;
                expect(res.headers['x-xss-protection']).to.not.exist;
                expect(res.headers['x-download-options']).to.not.exist;
                expect(res.headers['x-content-type-options']).to.not.exist;
                done();
            });

        });

        it('does not return hsts header when secuirty.hsts is false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist;
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });

        });

        it('returns only default hsts header when security.hsts is true', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is a number', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: 123456789 } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: { maxAge: 123456789, includeSubdomains: true } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789; includeSubdomains');
                done();
            });
        });

        it('returns the correct hsts header when security.hsts is an object only sepcifying maxAge', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: { maxAge: 123456789 } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubdomains', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { hsts: { includeSubdomains: true } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubdomains');
                done();
            });
        });

        it('does not return the xframe header whe security.xframe is false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.not.exist;
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });

        });

        it('returns only default xframe header when security.xframe is true', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is a string', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: 'sameorigin' } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is an object', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: { rule: 'allow-from', source: 'http://example.com' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('ALLOW-FROM http://example.com');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is an object', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: { rule: 'deny' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                done();
            });
        });

        it('returns sameorigin xframe header when rule is allow-from but source is unspecified', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xframe: { rule: 'allow-from' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
                done();
            });
        });

        it('does not set x-download-options if noOpen is false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { noOpen: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-download-options']).to.not.exist;
                done();
            });
        });

        it('does not set x-content-type-options if noSniff is false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { noSniff: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-content-type-options']).to.not.exist;
                done();
            });
        });

        it('does not set the x-xss-protection header when security.xss is false', function (done) {

            var handler = function (request, reply) {
                reply('Test');
            };

            var server = new Hapi.Server({ security: { xss: false } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Test');
                expect(res.headers['x-xss-protection']).to.not.exist;
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
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

            var server = new Hapi.Server({ json: { replacer: ['a'], space: 4, suffix: '\n' } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n    \"a\": 1\n}\n');
                done();
            });
        });

        it('returns a response with options', function (done) {

            var handler = function (request, reply) {

                reply({ a: 1, b: 2 }).type('application/x-test').spaces(2).replacer(['a']).suffix('\n');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
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
            server.route({ method: 'GET', path: '/', config: { response: { schema: { some: Joi.string() } } }, handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('{"some":"value"}');

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        it('validates response using custom validation function', function (done) {

            var i = 0;
            var handler = function (request, reply) {

                reply({ some: i++ ? null : 'value' });
            };

            var server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: function (value, options, next) {

                            return next(value.some === 'value' ? null : new Error('Bad response'));
                        }
                    }
                },
                handler: handler
            });

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

        it('returns a normal response when JSONP enabled but not requested', function (done) {

            var handler = function (request, reply) {

                reply({ some: 'value' });
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{"some":"value"}');
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

        it('captures object which cannot be stringify', function (done) {

            var handler = function (request, reply) {

                var obj = {};
                obj.a = obj;
                reply(obj);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
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

        it('returns an empty reply', function (done) {

            var handler = function (request, reply) {

                return reply().code(299);
            };

            var server = new Hapi.Server({ cors: { credentials: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

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

                reply.file('../package.json').code(499);
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

        it('returns a file in the response with the inline content-disposition header when using route config and overriding filename', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: './' } });
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'inline', filename: 'attachment.json' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('inline; filename=attachment.json');
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

        it('returns a file in the response with the attachment content-disposition header when using route config and overriding filename', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: { path: './package.json', mode: 'attachment', filename: 'attachment.json' } } });

            server.inject('/', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=attachment.json');
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

                reply.file(__dirname + '/../package.json', { mode: 'attachment' });
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

        it('returns a file with correct headers when using attachment mode and overriding the filename', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../package.json', { mode: 'attachment', filename: 'attachment.json' });
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('attachment; filename=attachment.json');
                done();
            });
        });

        it('returns a file with correct headers when using inline mode', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../package.json', { mode: 'inline' });
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

        it('returns a file with correct headers when using inline mode and overriding filename', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../package.json', { mode: 'inline', filename: 'attachment.json' });
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                expect(res.headers['content-disposition']).to.equal('inline; filename=attachment.json');
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

        it('returns a file using the build-in handler config', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            server.route({ method: 'GET', path: '/staticfile', handler: { file: __dirname + '/../package.json' } });

            server.inject('/staticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file using the file function with the build-in handler config', function (done) {

            var filenameFn = function (request) {

                return '../' + request.params.file;
            };

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
            server.route({ method: 'GET', path: '/relativestaticfile', handler: { file: '../package.json' } });

            server.inject('/relativestaticfile', function (res) {

                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist;
                done();
            });
        });

        it('returns a file with default mime type', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: __dirname + '/../bin/hapi' } });

            server.inject('/', function (res) {

                expect(res.headers['content-type']).to.equal('application/octet-stream');
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

                    expect(etag1.slice(0, 1)).to.equal('"');
                    expect(etag1.slice(-1)).to.equal('"');

                    // etag

                    server.inject({ url: '/note', headers: { 'if-none-match': etag1 } }, function (res3) {

                        expect(res3.statusCode).to.equal(304);
                        expect(res3.headers).to.not.have.property('content-length');
                        expect(res3.headers).to.not.have.property('etag');
                        expect(res3.headers).to.not.have.property('last-modified');

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

        it('returns a 304 when the request has if-modified-since and the response has not been modified since', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', function (res1) {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } }, function (res2) {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers).to.not.have.property('content-length');
                    expect(res2.headers).to.not.have.property('etag');
                    expect(res2.headers).to.not.have.property('last-modified');
                    done();
                });
            });
        });

        it('returns 200 if if-modified-since is invalid', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject({ url: '/file', headers: { 'if-modified-since': 'some crap' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returns 200 if last-modified is invalid', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok').header('last-modified', 'some crap'); } });

            server.inject({ url: '/', headers: { 'if-modified-since': 'Fri, 28 Mar 2014 22:52:39 GMT' } }, function (res2) {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });

        it('closes file handlers when not reading file stream', { skip: process.platform === 'win32' }, function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', function (res1) {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } }, function (res2) {

                    expect(res2.statusCode).to.equal(304);
                    var cmd = ChildProcess.spawn('lsof', ['-p', process.pid]);
                    var lsof = '';
                    cmd.stdout.on('data', function (buffer) {

                        lsof += buffer.toString();
                    });

                    cmd.stdout.on('end', function () {

                        var count = 0;
                        var lines = lsof.split('\n');
                        for (var i = 0, il = lines.length; i < il; ++i) {
                            count += !!lines[i].match(/package.json/);
                        }

                        expect(count).to.equal(0);
                        done();
                    });

                    cmd.stdin.end();
                });
            });
        });

        it('returns a gzipped file in the response when the request accepts gzip', function (done) {

            var server = new Hapi.Server({ files: { relativeTo: __dirname } });
            var handler = function (request, reply) {

                reply.file(__dirname + '/../package.json');
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

                reply.file(__dirname + '/../package.json');
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

            var content = Fs.readFileSync('./test/file/image.png.gz');

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/file/image.png', lookupCompressed: true } } });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-type']).to.equal('image/png');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload.length).to.equal(content.length);
                done();
            });
        });

        it('returns a gzipped file when precompressed file not found', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/file/note.txt', lookupCompressed: true } } });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('ignores _hapi decoration when missing gzipped child', function (done) {

            var handler = function (request, reply) {

                var stream = new Stream.Readable();
                stream._hapi = {};
                stream._read = function (size) {

                    this.push('ok');
                    this.push(null);
                };

                reply(stream);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist;
                expect(res.payload).to.exist;
                done();
            });
        });

        it('returns a 304 when using precompressed file and if-modified-since set', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/file/image.png', lookupCompressed: true } } });

            server.inject('/file', function (res1) {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date, 'accept-encoding': 'gzip' } }, function (res2) {

                    expect(res2.statusCode).to.equal(304);
                    done();
                });
            });
        });

        it('ignores precompressed file when content-encoding not requested', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/file', handler: { file: { path: './test/file/image.png', lookupCompressed: true } } });

            server.inject('/file', function (res) {

                expect(res.headers['content-type']).to.equal('image/png');
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

        it('returns error when file is removed before stream is opened', function (done) {

            var filename = internals.uniqueFilename(Os.tmpDir());
            Fs.writeFileSync(filename, 'data');

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: { file: filename } });
            server.ext('onPreResponse', function (request, reply) {

                Fs.unlinkSync(filename);
                reply();
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('Stream', function () {

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hoek.inherits(TestStream, Stream.Readable);

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

                Hoek.inherits(HeadersStream, Stream.Readable);

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

                Hoek.inherits(HeadersStream, Stream.Readable);

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

        Hoek.inherits(TimerStream, Stream.Readable);

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

            Hoek.inherits(ErrStream, Stream.Readable);

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

            Hoek.inherits(ErrStream, Stream.Readable);

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
            var filePath = __dirname + '/response.js';
            var block = Fs.readFileSync(filePath).toString();

            var expectedBody = '';
            for (var i = 0, il = chunkTimes; i < il; ++i) {
                expectedBody += block;
            }

            var fileHandler = function (request, reply) {

                var fileStream = new Stream.Readable();

                var readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                reply(fileStream);
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            server.start(function () {

                Nipple.get('http://localhost:' + server.info.port, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body === expectedBody).to.equal(true);
                    done();
                });
            });
        });

        it('does not truncate the response when stream finishes before response is done using https', function (done) {

            var chunkTimes = 10;
            var filePath = __dirname + '/response.js';
            var block = Fs.readFileSync(filePath).toString();

            var expectedBody = '';
            for (var i = 0, il = chunkTimes; i < il; ++i) {
                expectedBody += block;
            }

            var fileHandler = function (request, reply) {

                var fileStream = new Stream.Readable();

                var readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                reply(fileStream);
            };

            var config = {
                tls: {
                    key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                    cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
                }
            };

            var server = new Hapi.Server(0, config);
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            server.start(function () {

                Nipple.get('https://localhost:' + server.info.port, { rejectUnauthorized: false }, function (err, res, body) {

                    expect(err).to.not.exist;
                    expect(body === expectedBody).to.equal(true);
                    done();
                });
            });
        });

        it('does not leak stream data when request aborts before stream drains', function (done) {

            var destroyed = false;

            var handler = function (request, reply) {

                var stream = new Stream.Readable();

                stream._read = function (size) {

                    var self = this;

                    var chunk = new Array(size).join('x');

                    if (destroyed) {
                        this.push(chunk);
                        this.push(null);
                    }
                    else {

                        setTimeout(function () {

                            self.push(chunk);
                        }, 10);
                    }
                };

                stream.once('end', function () {

                    done();
                });

                reply(stream);
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/', handler: handler });

            server.start(function () {

                Nipple.request('GET', 'http://localhost:' + server.info.port, {}, function (err, res) {

                    res.on('data', function (chunk) {

                        if (!destroyed) {
                            destroyed = true;
                            res.destroy();
                        }
                    });
                });
            });
        });

        it('does not leak stream data when request timeouts before stream drains', function (done) {

            var handler = function (request, reply) {

                var stream = new Stream.Readable();
                var count = 0;
                stream._read = function (size) {

                    setTimeout(function () {

                        if (request._isFinalized) {
                            stream.push(null);
                        }
                        else {
                            stream.push(new Array(size).join('x'));
                        }
                    }, 10 * (count++));       // Must have back off here to hit the socket timeout
                };

                stream.once('end', function () {

                    done();
                });

                reply(stream);
            };

            var server = new Hapi.Server(0, { timeout: { server: 20, client: false, socket: 40 } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.start(function () {

                Nipple.request('GET', 'http://localhost:' + server.info.port, {}, function (err, res) {

                    expect(err).to.not.exist;
                    res.on('data', function (chunk) { });
                });
            });
        });

        it('does not leak stream data when request aborts before stream is returned', function (done) {

            var clientRequest;

            var handler = function (request, reply) {

                clientRequest.abort();

                var stream = new Stream.Readable();
                var responded = false;

                stream._read = function (size) {

                    var self = this;

                    var chunk = new Array(size).join('x');

                    if (responded) {
                        this.push(chunk);
                        this.push(null);
                    }
                    else {
                        setTimeout(function () {

                            responded = true;
                            self.push(chunk);
                        }, 10);
                    }
                };

                stream.once('end', function () {

                    done();
                });

                setTimeout(function () {

                    reply(stream);
                }, 100);
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'GET', path: '/', handler: handler });

            server.start(function () {

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });
                clientRequest.on('error', function () { /* NOP */ });
                clientRequest.end();
            });
        });
    });

    describe('View', function () {

        it('should not fail if rendered template returns undefined', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: {
                        html: {
                            module: {
                                compile: function (template, options) {

                                    return function (context, options) {

                                        return undefined;
                                    }
                                }
                            },
                            path: __dirname + '/templates/valid'
                        }
                    }
                }
            });

            var handler = function (request, reply) {

                return reply.view('test.html');
            };

            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('should render handlebars template', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: {
                        html: {
                            module: 'handlebars',
                            path: __dirname + '/templates/valid'
                        }
                    }
                }
            });

            var handler = function (request, reply) {

                return reply.view('test.html', { message: "Hello World!" });
            };

            server.route({ method: 'GET', path: '/handlebars', config: { handler: handler } });

            server.inject('/handlebars', function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('sets content type', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: {
                        html: {
                            module: 'handlebars',
                            path: __dirname + '/templates/valid',
                            contentType: 'something/else'
                        }
                    }
                }
            });

            var handler = function (request, reply) {

                return reply.view('test', { message: "Hello World!" });
            };

            server.route({ method: 'GET', path: '/', config: { handler: handler } });
            server.inject('/', function (res) {

                expect(res.headers['content-type']).to.equal('something/else');
                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('should throw if view module not found', function (done) {

            var fn = function () {

                var failServer = new Hapi.Server({
                    views: {
                        path: __dirname + '/templates/valid',
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
                    path: __dirname + '/templates/valid',
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

        it('returns error on invalid template path', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/invalid'
                }
            });

            var handler = function (request, reply) {

                reply.view('test', { message: 'Ohai' });
            };

            var handler = function (request, reply) {

                return reply.view('test', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns a compiled Handlebars template reply', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
            });

            var handler = function (request, reply) {

                return reply.view('test', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/views', config: { handler: handler } });

            server.inject('/views', function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.have.string('Hello, World!');
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returns an error absolute path given and allowAbsolutePath is false (by default)', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
            });

            var absoluteHandler = function (request, reply) {

                return reply.view(__dirname + '/templates/valid/test', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/views/abspath', config: { handler: absoluteHandler } });

            server.inject('/views/abspath', function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns an error if path given includes ../ and allowInsecureAccess is false (by default)', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
            });

            var insecureHandler = function (request, reply) {

                return reply.view('../test', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/views/insecure', config: { handler: insecureHandler } });

            server.inject('/views/insecure', function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('allows if path given includes ../ and allowInsecureAccess is true', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    allowInsecureAccess: true,
                    path: __dirname + '/templates/valid/helpers'
                }
            });

            var insecureHandler = function (request, reply) {

                return reply.view('../test', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/views/insecure', config: { handler: insecureHandler } });

            server.inject('/views/insecure', function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.have.string('Hello, World!');
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returns an error if template does not exist', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
            });

            var nonexistentHandler = function (request, reply) {

                return reply.view('testNope', { message: 'Hello, World!' });
            };

            server.route({ method: 'GET', path: '/views/nonexistent', config: { handler: nonexistentHandler } });

            server.inject('/views/nonexistent', function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns an error if engine.compile throws', function (done) {

            var server = new Hapi.Server({
                debug: false,
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
            });

            var invalidHandler = function (request, reply) {

                return reply.view('badmustache', { message: 'Hello, World!' }, { path: __dirname + '/templates/valid/invalid' });
            };

            server.route({ method: 'GET', path: '/views/invalid', config: { handler: invalidHandler } });

            server.inject('/views/invalid', function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        describe('Layout', function (done) {

            it('returns response', function (done) {

                var layoutServer = new Hapi.Server();
                layoutServer.views({
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates',
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
                    path: __dirname + '/templates',
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
                    path: __dirname + '/templates',
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
                    path: __dirname + '/templates',
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
                    basePath: __dirname,
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
                    path: __dirname + '/templates',
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
                    path: __dirname + '/templates',
                    layout: 'invalidLayout'
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
                    path: __dirname + '/templates',
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
                    path: __dirname + '/templates/valid',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('test', { message: 'Hello, World!', content: 'fail' });
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
                    path: __dirname + '/templates/valid',
                    layout: true
                });

                var handler = function (request, reply) {

                    return reply.view('test', { message: 'Hello, World!' }, { path: __dirname + '/templates/valid/invalid' });
                };

                layoutServer.route({ method: 'GET', path: '/abspath', handler: handler });

                layoutServer.inject('/abspath', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        describe('Caching', function () {

            it('should not throw if local cache disabled', function (done) {

                var fn = function () {

                    var testServer = new Hapi.Server({
                        views: {
                            engines: { 'html': 'handlebars' },
                            path: __dirname + '/templates/valid'
                        }
                    });

                    var handler = function (request, reply) {

                        return reply.view('test.html', { message: "Hello World!" });
                    };

                    testServer.route({ method: 'GET', path: '/handlebars', config: { handler: handler } });
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
                        path: __dirname + '/templates/valid',
                        isCached: true
                    }
                });

                var handler = function (request, reply) {

                    return reply.view('test.html', { message: "Hello World!" });
                };

                testServer.route({ method: 'GET', path: '/handlebars', config: { handler: handler } });
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
                        path: __dirname + '/templates/valid',
                        isCached: false
                    }
                });

                var handler = function (request, reply) {

                    return reply.view('test.html', { message: "Hello World!" });
                };

                testServer.route({ method: 'GET', path: '/handlebars', config: { handler: handler } });
                testServer.inject('/handlebars', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });

        describe('Multiple', function () {

            it('should render jade template', function (done) {

                var server = new Hapi.Server({
                    debug: false,
                    views: {
                        path: __dirname + '/templates/valid',
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

                var testMultiHandlerJade = function (request, reply) {

                    return reply.view('testMulti.jade', { message: "Hello World!" });
                };

                server.route({ method: 'GET', path: '/jade', config: { handler: testMultiHandlerJade } });

                server.inject('/jade', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });

            it('should render handlebars template', function (done) {

                var server = new Hapi.Server({
                    debug: false,
                    views: {
                        path: __dirname + '/templates/valid',
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

                var handler = function (request, reply) {

                    return reply.view('test.html', { message: "Hello World!" });
                };

                server.route({ method: 'GET', path: '/handlebars', config: { handler: handler } });

                server.inject('/handlebars', function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });

            it('should return 500 on unknown extension', function (done) {

                var server = new Hapi.Server({
                    debug: false,
                    views: {
                        path: __dirname + '/templates/valid',
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

                var testMultiHandlerUnknown = function (request, reply) {

                    return reply.view('test', { message: "Hello World!" });
                };

                server.route({ method: 'GET', path: '/unknown', config: { handler: testMultiHandlerUnknown } });

                server.inject('/unknown', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });

            it('should return 500 on missing extension engine', function (done) {

                var server = new Hapi.Server({
                    debug: false,
                    views: {
                        path: __dirname + '/templates/valid',
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

                var testMultiHandlerMissing = function (request, reply) {

                    return reply.view('test.xyz', { message: "Hello World!" });
                };

                server.route({ method: 'GET', path: '/missing', config: { handler: testMultiHandlerMissing } });

                server.inject('/missing', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });

    describe('Redirection', function () {

        it('returns a redirection reply', function (done) {

            var handler = function (request, reply) {

                return reply('Please wait while we send your elsewhere').redirect('example');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('http://example.org/', function (res) {

                expect(res.result).to.exist;
                expect(res.headers.location).to.equal('http://example.org/example');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a redirection reply using verbose call', function (done) {

            var handler = function (request, reply) {

                return reply('We moved!').redirect().location('examplex');
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('We moved!');
                expect(res.headers.location).to.equal('http://0.0.0.0:' + server.info.port + '/examplex');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 301 redirection reply', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable(false);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable(false);
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 301 redirection reply (reveresed methods)', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').rewritable().permanent();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply (reveresed methods)', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').rewritable().temporary();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply (reveresed methods)', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).temporary();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply (reveresed methods)', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).permanent();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 302 redirection reply (flip flop)', function (done) {

            var handler = function (request, reply) {

                return reply().redirect('example').permanent().temporary();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
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

    it('object listeners are maintained after transmission is complete', function (done) {

        var handler = function (request, reply) {

            reply('ok');
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        var response;
        server.ext('onPreResponse', function (request, reply) {

            response = request.response;
            response.once('special', function () {

                done();
            });

            reply();
        });

        server.inject('/', function (res) {

            response.emit('special');
        });
    });
});
