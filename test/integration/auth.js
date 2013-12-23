// Load modules

var Crypto = require('crypto');
var Lab = require('lab');
var Hawk = require('hawk');
var Stream = require('stream');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Auth', function () {

    describe('Hawk', function () {

        var credentials = {
            'john': {
                cred: {
                    id: 'john',
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'sha256'
                }
            },
            'jane': {
                err: Hapi.error.internal('boom')
            },
            'joan': {
                cred: {
                    id: 'joan',
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'sha256'
                }
            }
        };

        var getCredentials = function (id, callback) {

            if (credentials[id]) {
                return callback(credentials[id].err, credentials[id].cred);
            }
            else {
                return callback(null, null);
            }
        };

        var hawkHeader = function (id, path) {

            if (credentials[id] && credentials[id].cred) {
                return Hawk.client.header('http://example.com:8080' + path, 'POST', { credentials: credentials[id].cred });
            }
            else {
                return '';
            }
        };

        var server = new Hapi.Server();
        server.auth.strategy('default', 'hawk', { getCredentialsFunc: getCredentials });

        var hawkHandler = function (request, reply) {

            reply('Success');
        };

        var hawkErrorHandler = function (request, reply) {

            reply(new Error());
        };

        var hawkStreamHandler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hapi.utils.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                setTimeout(function () {

                    self.push('hi');
                }, 2);

                setTimeout(function () {

                    self.push(null);
                }, 5);
            };

            var stream = new TestStream();
            reply(stream);
        };

        server.route([
            { method: 'POST', path: '/hawk', handler: hawkHandler, config: { auth: true } },
            { method: 'POST', path: '/hawkValidate', handler: hawkHandler, config: { auth: true, validate: { query: {} } } },
            { method: 'POST', path: '/hawkError', handler: hawkErrorHandler, config: { auth: true } },
            { method: 'POST', path: '/hawkStream', handler: hawkStreamHandler, config: { auth: true } },
            { method: 'POST', path: '/hawkOptional', handler: hawkHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/hawkScope', handler: hawkHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/hawkTos', handler: hawkHandler, config: { auth: { tos: '2.0.0' } } },
            { method: 'POST', path: '/hawkPayload', handler: hawkHandler, config: { auth: { mode: 'required', payload: 'required' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkPayloadOptional', handler: hawkHandler, config: { auth: { mode: 'required', payload: 'optional' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkPayloadNone', handler: hawkHandler, config: { auth: { mode: 'required', payload: false }, payload: 'raw' } },
            { method: 'POST', path: '/hawkOptionalPayload', handler: hawkHandler, config: { auth: { mode: 'optional', payload: 'required' }, payload: 'raw' } }
        ]);

        it('returns a reply on successful auth', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawk', headers: { authorization: hawkHeader('john', '/hawk').field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on failed optional auth', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawkOptional' };

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('includes authorization header in response when the response is a stream', function (done) {

            var authHeader = hawkHeader('john', '/hawkStream');
            var request = { method: 'POST', url: 'http://example.com:8080/hawkStream', headers: { authorization: authHeader.field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['server-authorization']).to.contain('Hawk');

                var options = {
                    payload: res.payload
                };

                getCredentials('john', function (err, cred) {

                    var header = Hawk.server.header(cred, authHeader.artifacts, options);
                    expect(header).to.equal(res.headers['server-authorization']);
                    done();
                });
            });
        });

        it('includes valid authorization header in response when the response is text', function (done) {

            var authHeader = hawkHeader('john', '/hawk');
            var request = { method: 'POST', url: 'http://example.com:8080/hawk', headers: { authorization: authHeader.field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['server-authorization']).to.contain('Hawk');

                var options = {
                    payload: res.payload,
                    contentType: res.headers['content-type']
                };

                getCredentials('john', function (err, cred) {

                    var header = Hawk.server.header(cred, authHeader.artifacts, options);
                    expect(header).to.equal(res.headers['server-authorization']);

                    done();
                });
            });
        });

        it('includes valid authorization header in response when the request fails validation', function (done) {

            var authHeader = hawkHeader('john', '/hawkValidate?a=1');
            var request = { method: 'POST', url: 'http://example.com:8080/hawkValidate?a=1', headers: { authorization: authHeader.field } };

            server.inject(request, function (res) {

                expect(res.headers['server-authorization']).to.exist;
                expect(res.headers['server-authorization']).to.contain('Hawk');
                expect(res.statusCode).to.equal(400);

                var options = {
                    payload: res.payload,
                    contentType: res.headers['content-type']
                };

                getCredentials('john', function (err, cred) {

                    authHeader.artifacts.credentials = cred;
                    var header = Hawk.server.header(cred, authHeader.artifacts, options);
                    expect(header).to.equal(res.headers['server-authorization']);

                    done();
                });
            });
        });

        it('does not include authorization header in response when the response is an error', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawkError', headers: { authorization: hawkHeader('john', '/hawkError').field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.headers.authorization).to.not.exist;
                done();
            });
        });

        it('returns an error on bad auth header', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawk', headers: { authorization: hawkHeader('john', 'abcd').field } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns an error on bad header format', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawk', headers: { authorization: 'junk' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns an error on bad scheme', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawk', headers: { authorization: 'junk something' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawkTos', headers: { authorization: hawkHeader('john', '/hawkTos').field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var request = { method: 'POST', url: 'http://example.com:8080/hawkScope', headers: { authorization: hawkHeader('john', '/hawkScope').field } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns a reply on successful auth when using a custom host header key', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', '/hawk').field, custom: 'example.com:8080' } };

            var server = new Hapi.Server();
            server.auth.strategy('default', 'hawk', {
                getCredentialsFunc: getCredentials,
                hawk: {
                    hostHeaderName: 'custom'
                }
            });

            server.route({ method: 'POST', path: '/hawk', handler: hawkHandler, config: { auth: true } });

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth and payload validation', function (done) {

            var payload = 'application text formatted payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayload', 'POST', { credentials: credentials.john.cred, payload: payload, contentType: 'application/text' });
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayload', headers: { authorization: authHeader.field, 'content-type': 'application/text' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayload', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with and the route has optional validation', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayloadOptional', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns a reply on successful auth and payload validation when validation is optional', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayloadOptional', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when payload validation is optional and no payload hash exists', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred });
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayloadOptional', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth and when payload validation is disabled', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayloadNone', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayloadNone', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when the payload is tampered with and the route has disabled validation', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayloadNone', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayloadNone', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when auth is optional and when payload validation is required', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkOptionalPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: 'http://example.com:8080/hawkOptionalPayload', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with and the route has optional auth', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkOptionalPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: 'http://example.com:8080/hawkOptionalPayload', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns an error with payload validation when the payload hash is not included and payload validation is required', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://example.com:8080/hawkPayload', 'POST', { credentials: credentials.john.cred });

            var request = { method: 'POST', url: 'http://example.com:8080/hawkPayload', headers: { authorization: authHeader.field }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });
    });

    describe('Bewit', function () {

        var credentials = {
            'john': {
                cred: {
                    id: 'john',
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'sha256'
                }
            },
            'jane': {
                err: Hapi.error.internal('boom')
            }
        };

        var getCredentials = function (id, callback) {

            if (credentials[id]) {
                return callback(credentials[id].err, credentials[id].cred);
            }
            else {
                return callback(null, null);
            }
        };

        var getBewit = function (id, path) {

            if (credentials[id] && credentials[id].cred) {
                return Hawk.uri.getBewit('http://example.com:8080' + path, { credentials: credentials[id].cred, ttlSec: 60 });
            }
            else {
                return '';
            }
        };

        var server = new Hapi.Server();
        server.auth.strategy('default', 'bewit', { getCredentialsFunc: getCredentials })

        var bewitHandler = function (request, reply) {

            reply('Success');
        };

        server.route([
            { method: 'GET', path: '/bewit', handler: bewitHandler, config: { auth: true } },
            { method: 'GET', path: '/bewitOptional', handler: bewitHandler, config: { auth: { mode: 'optional' } } },
            { method: 'GET', path: '/bewitScope', handler: bewitHandler, config: { auth: { scope: 'x' } } },
            { method: 'GET', path: '/bewitTos', handler: bewitHandler, config: { auth: { tos: '2.0.0' } } }
        ]);

        it('returns a reply on successful auth', function (done) {

            var bewit = getBewit('john', '/bewit');
            server.inject('http://example.com:8080/bewit?bewit=' + bewit, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error reply on failed optional auth', function (done) {

            var bewit = getBewit('john', '/abc');
            server.inject('http://example.com:8080/bewitOptional?bewit=' + bewit, function (res) {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns an error on bad bewit', function (done) {

            var bewit = getBewit('john', '/abc');
            server.inject('http://example.com:8080/bewit?bewit=' + bewit, function (res) {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns an error on bad bewit format', function (done) {

            server.inject('http://example.com:8080/bewit?bewit=junk', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            var bewit = getBewit('john', '/bewitTos');
            server.inject('http://example.com:8080/bewitTos?bewit=' + bewit, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var bewit = getBewit('john', '/bewitScope');
            server.inject('http://example.com:8080/bewitScope?bewit=' + bewit, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('returns a reply on successful auth when using a custom host header key', function (done) {

            var bewit = getBewit('john', '/bewit');
            var request = { method: 'GET', url: '/bewit?bewit=' + bewit, headers: { custom: 'example.com:8080' } };

            var server = new Hapi.Server();
            server.auth.strategy('default', 'bewit', {
                getCredentialsFunc: getCredentials,
                hawk: {
                    hostHeaderName: 'custom'
                }
            });

            server.route({ method: 'GET', path: '/bewit', handler: bewitHandler, config: { auth: true } });

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('cannot add a route that has payload validation required', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/bewitPayload', handler: bewitHandler, config: { auth: { mode: 'required', payload: 'required' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('cannot add a route that has payload validation as optional', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/bewitPayload', handler: bewitHandler, config: { auth: { mode: 'required', payload: 'optional' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('can add a route that has payload validation as none', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/bewitPayload', handler: bewitHandler, config: { auth: { mode: 'required', payload: false }, payload: 'raw' } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });
});
