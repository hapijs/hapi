// Load modules

var Crypto = require('crypto');
var Lab = require('lab');
var Oz = require('oz');
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

    var basicHeader = function (username, password) {

        return 'Basic ' + (new Buffer(username + ':' + password, 'utf8')).toString('base64');
    };

    describe('Basic', function () {

        var hashPassword = function (password) {

            var hash = Crypto.createHash('sha1');
            hash.update(password, 'utf8');

            return hash.digest('base64');
        };

        var loadUser = function (id, callback) {

            if (id === 'john') {
                return callback(null, {
                    id: 'john',
                    password: hashPassword('12345'),
                    scope: [],
                    ext: {
                        tos: 100
                    }
                });
            }
            else if (id === 'jane') {
                return callback(Hapi.error.internal('boom'));
            }
            else if (id === 'invalid') {
                return callback(null, {});
            }
            else {
                return callback(null, null);
            }
        };

        var config = {
            auth: {
                scheme: 'basic',
                loadUserFunc: loadUser,
                hashPasswordFunc: hashPassword
            }
        };

        var server = new Hapi.Server(config);

        var basicHandler = function (request) {

            request.reply('Success');
        };

        var doubleHandler = function (request) {

            var options = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('john', '12345') }, session: request.session };

            server.inject(options, function (res) {

                request.reply(res.result);
            });
        };

        server.route([
            { method: 'POST', path: '/basic', handler: basicHandler },
            { method: 'POST', path: '/basicOptional', handler: basicHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/basicScope', handler: basicHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/basicTos', handler: basicHandler, config: { auth: { tos: 200 } } },
            { method: 'POST', path: '/double', handler: doubleHandler }
        ]);

        it('returns a reply on successful auth', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('john', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful double auth', function (done) {

            var request = { method: 'POST', url: '/double', headers: { authorization: basicHeader('john', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on failed optional auth', function (done) {

            var request = { method: 'POST', url: '/basicOptional' };

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error on bad password', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('john', 'abcd') } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad header format', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: 'basic' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                expect(res.result.isMissing).to.equal(undefined);
                done();
            });
        });

        it('returns an error on bad header internal syntax', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: 'basic 123' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                expect(res.result.isMissing).to.equal(undefined);
                done();
            });
        });

        it('returns an error on bad scheme', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: 'something' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on unknown user', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('doe', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on internal user lookup error', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('jane', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns an error on invalid user lookup error', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('invalid', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            var request = { method: 'POST', url: '/basicTos', headers: { authorization: basicHeader('john', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var request = { method: 'POST', url: '/basicScope', headers: { authorization: basicHeader('john', '12345') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('should not ask for credentials if no server auth configured', function (done) {

            var config = {};
            var server = new Hapi.Server(config);
            server.route({
                path: '/noauth',
                method: 'GET',
                config: {
                    handler: function (req) {

                        req.reply('Success');
                    }
                }
            });
            var options = { method: 'GET', url: '/noauth' };

            server.inject(options, function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('should ask for credentials if server has one default strategy', function (done) {

            var config = {
                auth: {
                    scheme: 'basic',
                    loadUserFunc: loadUser,
                    hashPasswordFunc: hashPassword
                }
            };
            var server = new Hapi.Server(config);
            server.route({
                path: '/noauth',
                method: 'GET',
                config: {
                    handler: function (req) {

                        req.reply('Success');
                    }
                }
            });

            var validOptions = { method: 'GET', url: '/noauth', headers: { authorization: basicHeader('john', '12345') } };
            server.inject(validOptions, function (res) {

                expect(res.result).to.exist;
                expect(res.statusCode).to.equal(200);

                var invalidOptions = { method: 'GET', url: '/noauth' };
                server.inject(invalidOptions, function (res) {

                    expect(res.result).to.exist;
                    expect(res.statusCode).to.equal(401);
                    done();
                });
            });
        });

        it('should throw if server has strategies route refers to nonexistent strategy', function (done) {

            var config = {
                auth: {
                    'default': {
                        scheme: 'basic',
                        loadUserFunc: loadUser
                    },
                    'b': {
                        scheme: 'basic',
                        loadUserFunc: loadUser
                    }
                }
            };
            var server = new Hapi.Server(config);

            var fn = function () {

                server.route({
                    path: '/noauth',
                    method: 'GET',
                    config: {
                        auth: {
                            strategy: 'hello'
                        },
                        handler: function (req) {

                            req.reply('Success');
                        }
                    }
                });
            };

            expect(fn).to.throw();
            done();
        });

        it('cannot add a route that has payload validation required', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/basicPayload', handler: basicHandler, config: { auth: { mode: 'required', payload: 'required' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('cannot add a route that has payload validation as optional', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/basicPayload', handler: basicHandler, config: { auth: { mode: 'required', payload: 'optional' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('can add a route that has payload validation as none', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/basicPayload', handler: basicHandler, config: { auth: { mode: 'required', payload: 'none' }, payload: 'raw' } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('Oz', function () {

        var loadApp = function (id, callback) {

            var app = {
                id: id,
                secret: '8dunq9823udn',
                scope: ['y']
            };

            return callback(app);
        };

        var loadGrant = function (id, callback) {

            var result = {
                id: id,
                app: '123',
                user: '456',
                exp: Date.now() + 5000,
                scope: ['y']
            };

            return callback(result);
        };

        var config = {
            auth: {
                scheme: 'oz',
                encryptionPassword: '47dqyboq387yd5qo',
                loadAppFunc: loadApp,
                loadGrantFunc: loadGrant
            }
        };

        var server = new Hapi.Server(config);

        var ozHandler = function (request) {

            request.reply('Success');
        };

        server.route([
            { method: 'POST', path: '/oz', handler: ozHandler },
            { method: 'POST', path: '/ozOptional', handler: ozHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/ozScope', handler: ozHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/ozTos', handler: ozHandler, config: { auth: { tos: 200 } } }
        ]);

        var ozHeader = function (path, callback) {

            var app = {
                id: '123'
            };

            var grant = {
                id: 's81u29n1812',
                user: '456',
                exp: Date.now() + 5000,
                scope: ['y']
            };

            Oz.ticket.issue(app, grant, config.auth.encryptionPassword, {}, function (err, envelope) {

                var request = {
                    method: 'POST',
                    resource: path,
                    host: 'example.com',
                    port: 8080
                };

                return callback(Oz.Request.generateHeader(request, envelope));
            });
        };

        it('returns a reply on successful auth', function (done) {

            ozHeader('/oz', function (header) {

                var request = { method: 'POST', url: '/oz', headers: { host: 'example.com:8080', authorization: header } };

                server.inject(request, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result).to.equal('Success');
                    done();
                });
            });
        });

        it('returns a reply on successful app endpoint request', function (done) {

            var request = { method: 'POST', url: '/oz/app', headers: { host: 'example.com:8080', authorization: basicHeader('123', '8dunq9823udn') } };

            server.inject(request, function (res) {

                expect(res.payload).to.exist;
                var envelope = JSON.parse(res.payload);
                expect(envelope.app).to.equal('123');
                done();
            });
        });

        it('returns a reply on failed optional auth', function (done) {

            var request = { method: 'POST', url: '/ozOptional', headers: { host: 'example.com:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            ozHeader('/ozTos', function (header) {

                var request = { method: 'POST', url: '/ozTos', headers: { host: 'example.com:8080', authorization: header } };

                server.inject(request, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result.code).to.equal(403);
                    done();
                });
            });
        });

        it('returns an error on insufficient scope', function (done) {

            ozHeader('/ozScope', function (header) {

                var request = { method: 'POST', url: '/ozScope', headers: { host: 'example.com:8080', authorization: header } };

                server.inject(request, function (res) {

                    expect(res.result).to.exist;
                    expect(res.result.code).to.equal(403);
                    done();
                });
            });
        });

        it('cannot add a route that has payload validation required', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/ozPayload', handler: ozHandler, config: { auth: { mode: 'required', payload: 'required' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('cannot add a route that has payload validation as optional', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/ozPayload', handler: ozHandler, config: { auth: { mode: 'required', payload: 'optional' }, payload: 'raw' } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('can add a route that has payload validation as none', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/ozPayload', handler: ozHandler, config: { auth: { mode: 'required', payload: 'none' }, payload: 'raw' } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

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
                return Hawk.client.header('http://0.0.0.0:8080' + path, 'POST', { credentials: credentials[id].cred }).field;
            }
            else {
                return '';
            }
        };

        var config = {
            auth: {
                scheme: 'hawk',
                getCredentialsFunc: getCredentials
            }
        };

        var server = new Hapi.Server(config);

        var hawkHandler = function (request) {

            request.reply.payload('Success').send();
        };

        var hawkChangeHandler = function (request) {

            request.session.algorithm = 'ha';
            request.reply.payload('Success').send();
        };

        var hawkErrorHandler = function (request) {

            request.reply.payload(new Error()).send();
        };

        var hawkStreamHandler = function (request) {

            var stream = new Stream();
            stream.readable = true;
            stream.resume = function () {

                setTimeout(function () {

                    stream.emit('data', 'hi');
                }, 2);

                setTimeout(function () {

                    stream.emit('end', '');
                }, 5);
            };

            request.reply.stream(stream).send();
        };

        server.route([
            { method: 'POST', path: '/hawk', handler: hawkHandler },
            { method: 'POST', path: '/hawkchange', handler: hawkChangeHandler },
            { method: 'POST', path: '/hawkError', handler: hawkErrorHandler },
            { method: 'POST', path: '/hawkStream', handler: hawkStreamHandler },
            { method: 'POST', path: '/hawkOptional', handler: hawkHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/hawkScope', handler: hawkHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/hawkTos', handler: hawkHandler, config: { auth: { tos: 200 } } },
            { method: 'POST', path: '/hawkPayload', handler: hawkHandler, config: { auth: { mode: 'required', payload: 'required' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkPayloadOptional', handler: hawkHandler, config: { auth: { mode: 'required', payload: 'optional' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkPayloadNone', handler: hawkHandler, config: { auth: { mode: 'required', payload: 'none' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkOptionalPayload', handler: hawkHandler, config: { auth: { mode: 'optional', payload: 'required' }, payload: 'raw' } },
            { method: 'POST', path: '/hawkNonePayload', handler: hawkHandler, config: { auth: { mode: 'none', payload: 'required' }, payload: 'raw' } }
        ]);

        it('returns a reply on successful auth', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', '/hawk'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on failed optional auth', function (done) {

            var request = { method: 'POST', url: '/hawkOptional', headers: { host: 'example.com:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('includes authorization header in response when the response is a stream', function (done) {

            var request = { method: 'POST', url: '/hawkStream', headers: { authorization: hawkHeader('john', '/hawkStream'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.raw.res._trailer).to.contain('Hawk');

                var attributes = Hawk.utils.parseAuthorizationHeader(res.raw.req.headers.authorization);

                var artifacts = {
                    method: res.raw.req.method,
                    host: res.raw.req.headers.host.split(':')[0],
                    port: res.raw.req.headers.host.split(':')[1],
                    resource: res.raw.req.url,
                    ts: attributes.ts,
                    nonce: attributes.nonce,
                    ext: attributes.ext,
                    mac: attributes.mac
                };

                var options = {
                    payload: res.payload
                };

                getCredentials('john', function (err, cred) {

                    artifacts.credentials = cred;
                    var header = Hawk.server.header(artifacts, options);
                    var trailerAuth = res.raw.res._trailer.split(':')[1];
                    trailerAuth = trailerAuth.substr(1, trailerAuth.lastIndexOf('"'));

                    expect(res.headers.trailer).to.contain('Authorization');
                    expect(header).to.equal(trailerAuth);
                    done();
                });
            });
        });

        it('includes valid authorization header in response when the response is text', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', '/hawk'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.headers.authorization).to.contain('Hawk');
                expect(res.statusCode).to.equal(200);

                var attributes = Hawk.utils.parseAuthorizationHeader(res.raw.req.headers.authorization);

                var artifacts = {
                    method: res.raw.req.method,
                    host: res.raw.req.headers.host.split(':')[0],
                    port: res.raw.req.headers.host.split(':')[1],
                    resource: res.raw.req.url,
                    ts: attributes.ts,
                    nonce: attributes.nonce,
                    ext: attributes.ext,
                    mac: attributes.mac
                };

                var options = {
                    payload: res.payload,
                    contentType: res.headers['content-type']
                };

                getCredentials('john', function (err, cred) {

                    artifacts.credentials = cred;
                    var header = Hawk.server.header(artifacts, options);
                    expect(header).to.equal(res.headers.authorization);

                    done();
                });
            });
        });

        it('returns an error when the hawk auth response header can\'t be created', function (done) {

            var request = { method: 'POST', url: '/hawkchange', headers: { authorization: hawkHeader('joan', '/hawkchange'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('doesn\'t include authorization header in response when the response is an error', function (done) {

            var request = { method: 'POST', url: '/hawkError', headers: { authorization: hawkHeader('john', '/hawkError'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.headers.authorization).to.not.exist;
                done();
            });
        });

        it('returns an error on bad auth header', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', 'abcd'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad header format', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: 'junk', host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad scheme', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: 'junk something', host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            var request = { method: 'POST', url: '/hawkTos', headers: { authorization: hawkHeader('john', '/hawkTos'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var request = { method: 'POST', url: '/hawkScope', headers: { authorization: hawkHeader('john', '/hawkScope'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns a reply on successful auth when using a custom host header key', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', '/hawk'), custom: '0.0.0.0:8080' } };

            var config = {
                auth: {
                    scheme: 'hawk',
                    getCredentialsFunc: getCredentials,
                    hostHeaderName: 'custom'
                }
            };

            var server = new Hapi.Server(config);
            server.route({ method: 'POST', path: '/hawk', handler: hawkHandler });

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth and payload validation', function (done) {

            var payload = 'application text formatted payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayload', 'POST', { credentials: credentials.john.cred, payload: payload, contentType: 'application/text' });
            var request = { method: 'POST', url: '/hawkPayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080', 'content-type': 'application/text' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/hawkPayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with and the route has optional validation', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/hawkPayloadOptional', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns a reply on successful auth and payload validation when validation is optional', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: '/hawkPayloadOptional', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when payload validation is optional and no payload hash exists', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayloadOptional', 'POST', { credentials: credentials.john.cred });
            var request = { method: 'POST', url: '/hawkPayloadOptional', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth and when payload validation is disabled', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayloadNone', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: '/hawkPayloadNone', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when the payload is tampered with and the route has disabled validation', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkPayloadNone', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/hawkPayloadNone', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth when auth is optional and when payload validation is required', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkOptionalPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: '/hawkOptionalPayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error with payload validation when the payload is tampered with and the route has optional auth', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkOptionalPayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/hawkOptionalPayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns a successful reply with payload validation required when the payload is tampered with and the route has no auth', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/hawkNonePayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/hawkNonePayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
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
                return Hawk.uri.getBewit('http://0.0.0.0:8080' + path, { credentials: credentials[id].cred, ttlSec: 60 });
            }
            else {
                return '';
            }
        };

        var config = {
            auth: {
                scheme: 'bewit',
                getCredentialsFunc: getCredentials
            }
        };

        var server = new Hapi.Server(config);

        var bewitHandler = function (request) {

            request.reply('Success');
        };

        server.route([
            { method: 'GET', path: '/bewit', handler: bewitHandler },
            { method: 'GET', path: '/bewitOptional', handler: bewitHandler, config: { auth: { mode: 'optional' } } },
            { method: 'GET', path: '/bewitScope', handler: bewitHandler, config: { auth: { scope: 'x' } } },
            { method: 'GET', path: '/bewitTos', handler: bewitHandler, config: { auth: { tos: 200 } } }
        ]);

        it('returns a reply on successful auth', function (done) {

            var bewit = getBewit('john', '/bewit');
            var request = { method: 'GET', url: '/bewit?bewit=' + bewit, headers: { host: '0.0.0.0:8080' }};

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error reply on failed optional auth', function (done) {

            var bewit = getBewit('john', '/abc');
            var request = { method: 'GET', url: '/bewitOptional?bewit=' + bewit, headers: { host: 'example.com:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad bewit', function (done) {

            var bewit = getBewit('john', '/abc');
            var request = { method: 'GET', url: '/bewit?bewit=' + bewit, headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad bewit format', function (done) {

            var request = { method: 'GET', url: '/bewit?bewit=junk', headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('returns an error on insufficient tos', function (done) {

            var bewit = getBewit('john', '/bewitTos');
            var request = { method: 'GET', url: '/bewitTos?bewit=' + bewit, headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var bewit = getBewit('john', '/bewitScope');
            var request = { method: 'GET', url: '/bewitScope?bewit=' + bewit, headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns a reply on successful auth when using a custom host header key', function (done) {

            var bewit = getBewit('john', '/bewit');
            var request = { method: 'GET', url: '/bewit?bewit=' + bewit, headers: { custom: '0.0.0.0:8080' } };

            var config = {
                auth: {
                    scheme: 'bewit',
                    getCredentialsFunc: getCredentials,
                    hostHeaderName: 'custom'
                }
            };

            var server = new Hapi.Server(config);
            server.route({ method: 'GET', path: '/bewit', handler: bewitHandler });

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

                server.route({ method: 'POST', path: '/bewitPayload', handler: bewitHandler, config: { auth: { mode: 'required', payload: 'none' }, payload: 'raw' } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('Ext', function () {

        it('returns a reply on successful ext any', function (done) {

            var config = {
                auth: {
                    scheme: 'ext:any',
                    implementation: {

                        authenticate: function (request, callback) {

                            callback(null, {});
                        }
                    }
                }
            };

            var handler = function (request) {

                request.reply('Success');
            };

            var server = new Hapi.Server(config);
            server.route({ method: 'POST', path: '/ext', handler: handler });

            var request = { method: 'POST', url: '/ext' };
            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });
    });

    describe('Multiple', function () {

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

        var loadUser = function (id, callback) {

            if (id === 'john') {
                return callback(null, {
                    id: 'john',
                    password: '12345',
                    scope: [],
                    ext: {
                        tos: 100
                    }
                });
            }
            else if (id === 'jane') {
                return callback(Hapi.error.internal('boom'));
            }
            else if (id === 'invalid') {
                return callback(null, {});
            }
            else {
                return callback(null, null);
            }
        };

        var hawkHeader = function (id, path) {

            if (credentials[id] && credentials[id].cred) {
                return Hawk.client.header('http://0.0.0.0:8080' + path, 'POST', { credentials: credentials[id].cred }).field;
            }
            else {
                return '';
            }
        };

        var config = {
            auth: {
                'default': {
                    scheme: 'hawk',
                    getCredentialsFunc: getCredentials
                },
                'hawk': {
                    scheme: 'hawk',
                    getCredentialsFunc: getCredentials
                },
                'basic': {
                    scheme: 'basic',
                    loadUserFunc: loadUser
                }
            }
        };

        var server = new Hapi.Server(config);

        var handler = function (request) {

            request.reply('Success');
        };

        server.route([
            { method: 'POST', path: '/multiple', handler: handler, config: { auth: { strategies: ['basic', 'hawk'] } } },
            { method: 'POST', path: '/multipleOptional', handler: handler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/multipleScope', handler: handler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/multipleTos', handler: handler, config: { auth: { tos: 200 } } },
            { method: 'POST', path: '/multiplePayload', handler: handler, config: { auth: { strategies: ['basic', 'hawk'], payload: 'optional' }, payload: 'raw' } }
        ]);

        it('returns a reply on successful auth of first auth strategy', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: basicHeader('john', '12345'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on successful auth of second auth strategy', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: hawkHeader('john', '/multiple'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error when the auth strategies fail', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: 'Basic fail', host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('returns a 401 response when missing the authorization header', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('returns a WWW-Authenticate header that has all challenge options when missing the authorization header', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.headers['www-authenticate']).to.contain('Hawk');
                expect(res.headers['www-authenticate']).to.contain('Basic');
                done();
            });
        });

        it('returns a 400 error when the authorization header has both Basic and Hawk and both are wrong', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: 'Basic fail; Hawk fail', host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('returns a 400 response when the authorization header has both Basic and Hawk and the second one is correct', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: 'Basic fail; ' + hawkHeader('john', '/multiple'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('returns full error message on bad auth header', function (done) {

            var request = { method: 'POST', url: '/multiple', headers: { authorization: hawkHeader('john', 'abcd'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result.code).to.equal(401);
                expect(res.result.message).to.equal('Bad mac');
                done();
            });
        });

        it('cannot add a route that has payload validation required when one of the server strategies doesn\'t support it', function (done) {

            var fn = function () {

                server.route({ method: 'POST', path: '/multiplePayload', handler: handler, config: { auth: { strategies: ['basic', 'hawk'], payload: 'required' } } });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('returns an error with payload validation when the payload is tampered with and the route has optional auth', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/multiplePayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            payload += 'HACKED';
            var request = { method: 'POST', url: '/multiplePayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(401);
                expect(res.result.message).to.equal('Payload is invalid');
                done();
            });
        });

        it('returns a successful reply with payload validation as optional when the payload is valid', function (done) {

            var payload = 'Here is my payload';
            var authHeader = Hawk.client.header('http://0.0.0.0:8080/multiplePayload', 'POST', { credentials: credentials.john.cred, payload: payload });
            var request = { method: 'POST', url: '/multiplePayload', headers: { authorization: authHeader.field, host: '0.0.0.0:8080' }, payload: payload };

            server.inject(request, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Success');
                done();
            });
        });
    });

    describe('Cookie', function (done) {

        var config = {
            scheme: 'cookie',
            password: 'password',
            ttl: 60 * 1000,
            cookie: 'special',
            clearInvalid: true,
            validateFunc: function (session, callback) {

                var override = Hapi.utils.clone(session);
                override.something = 'new';

                return callback(session.user === 'valid' ? null : new Error('bad user'), override);
            }
        };

        var server = new Hapi.Server({ auth: config });

        server.route({
            method: 'GET', path: '/login/{user}', config: {
                auth: { mode: 'try' }, handler: function () {

                    this.setSession({ user: this.params.user });

                    return this.reply(this.params.user);
                }
            }
        });

        server.route({
            method: 'GET', path: '/resource', handler: function () {

                expect(this.session.something).to.equal('new');
                return this.reply('resource');
            }
        });

        server.route({
            method: 'GET', path: '/logout', handler: function () {

                this.clearSession();
                return this.reply('logged-out');
            }
        });

        it('authenticates a request', function (done) {

            server.inject({ method: 'GET', url: '/login/valid' }, function (res) {

                expect(res.result).to.equal('valid');
                var header = res.headers['set-cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60');
                var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('resource');
                    done();
                });
            });
        });

        it('ends a session', function (done) {

            server.inject({ method: 'GET', url: '/login/valid' }, function (res) {

                expect(res.result).to.equal('valid');
                var header = res.headers['set-cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60');
                var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('logged-out');
                    expect(res.headers['set-cookie'][0]).to.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/');
                    done();
                });
            });
        });

        it('fails a request with invalid session', function (done) {

            server.inject({ method: 'GET', url: '/login/invalid' }, function (res) {

                expect(res.result).to.equal('invalid');
                var header = res.headers['set-cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60');
                var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } }, function (res) {

                    expect(res.headers['set-cookie'][0]).to.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/');
                    expect(res.statusCode).to.equal(401);
                    done();
                });
            });
        });

        describe('redirection', function (done) {

            it('sends to login page (uri without query)', function (done) {

                var config = {
                    scheme: 'cookie',
                    password: 'password',
                    ttl: 60 * 1000,
                    redirectTo: 'http://example.com/login',
                    appendNext: true,
                    validateFunc: function (session, callback) {

                        return callback();
                    }
                };

                var server = new Hapi.Server({ auth: config });

                server.route({
                    method: 'GET', path: '/', handler: function () {

                        return this.reply('never');
                    }
                });

                server.inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.equal('You are being redirected...');
                    expect(res.statusCode).to.equal(302);
                    expect(res.headers.location).to.equal('http://example.com/login?next=%2F');
                    done();
                });
            });

            it('sends to login page (uri with query)', function (done) {

                var config = {
                    scheme: 'cookie',
                    password: 'password',
                    ttl: 60 * 1000,
                    redirectTo: 'http://example.com/login?mode=1',
                    appendNext: true,
                    validateFunc: function (session, callback) {

                        return callback();
                    }
                };

                var server = new Hapi.Server({ auth: config });

                server.route({
                    method: 'GET', path: '/', handler: function () {

                        return this.reply('never');
                    }
                });

                server.inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.equal('You are being redirected...');
                    expect(res.statusCode).to.equal(302);
                    expect(res.headers.location).to.equal('http://example.com/login?mode=1&next=%2F');
                    done();
                });
            });

            it('sends to login page and doesn\'t append the next query when appendNext is false', function (done) {

                var config = {
                    scheme: 'cookie',
                    password: 'password',
                    ttl: 60 * 1000,
                    redirectTo: 'http://example.com/login?mode=1',
                    appendNext: false,
                    validateFunc: function (session, callback) {

                        return callback();
                    }
                };

                var server = new Hapi.Server({ auth: config });

                server.route({
                    method: 'GET', path: '/', handler: function () {

                        return this.reply('never');
                    }
                });

                server.inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.equal('You are being redirected...');
                    expect(res.statusCode).to.equal(302);
                    expect(res.headers.location).to.equal('http://example.com/login?mode=1');
                    done();
                });
            });

            it('does not redirect on try', function (done) {

                var config = {
                    scheme: 'cookie',
                    password: 'password',
                    ttl: 60 * 1000,
                    redirectTo: 'http://example.com/login',
                    appendNext: true,
                    validateFunc: function (session, callback) {

                        return callback();
                    }
                };

                var server = new Hapi.Server({ auth: config });

                server.route({
                    method: 'GET', path: '/', config: { auth: { mode: 'try' } }, handler: function () {

                        return this.reply('try');
                    }
                });

                server.inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.equal('try');
                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });
});