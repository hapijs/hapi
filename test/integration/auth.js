// Load modules

var Crypto = require('crypto');
var Chai = require('chai');
var Oz = require('oz');
var Hawk = require('hawk');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


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

        var server = new Hapi.Server('0.0.0.0', 0, config);

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
            var server = new Hapi.Server('0.0.0.0', 8080, config);
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
            var server = new Hapi.Server('0.0.0.0', 8080, config);
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
            var server = new Hapi.Server('0.0.0.0', 0, config);

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

        var server = new Hapi.Server('example.com', 8080, config);

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

                expect(res.result).to.exist;
                var envelope = JSON.parse(res.readPayload());
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
                return Hawk.getAuthorizationHeader(credentials[id].cred, 'POST', path, '0.0.0.0', 8080);
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

        var server = new Hapi.Server('0.0.0.0', 8080, config);

        var hawkHandler = function (request) {

            request.reply('Success');
        };

        server.route([
            { method: 'POST', path: '/hawk', handler: hawkHandler },
            { method: 'POST', path: '/hawkOptional', handler: hawkHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/hawkScope', handler: hawkHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/hawkTos', handler: hawkHandler, config: { auth: { tos: 200 } } }
        ]);

        it('returns a reply on successful auth', function (done) {

            var request = { method: 'POST', url: '/hawk', headers: { authorization: hawkHeader('john', '/hawk'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns a reply on failed optional auth', function (done) {

            var request = { method: 'POST', url: '/hawkOptional', headers: { host: 'example.com:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
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

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(403);
                done();
            });
        });

        it('returns an error on insufficient scope', function (done) {

            var request = { method: 'POST', url: '/hawkScope', headers: { authorization: hawkHeader('john', '/hawkScope'), host: '0.0.0.0:8080' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
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

            var server = new Hapi.Server('0.0.0.0', 8080, config);
            server.route({ method: 'POST', path: '/hawk', handler: hawkHandler });

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
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

            var server = new Hapi.Server('0.0.0.0', 8080, config);
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
                return Hawk.getAuthorizationHeader(credentials[id].cred, 'POST', path, '0.0.0.0', 8080);
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

        var server = new Hapi.Server('0.0.0.0', 8080, config);

        var handler = function (request) {

            request.reply('Success');
        };

        server.route([
            { method: 'POST', path: '/multiple', handler: handler, config: { auth: { strategies: ['basic', 'hawk'] } } },
            { method: 'POST', path: '/multipleOptional', handler: handler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/multipleScope', handler: handler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/multipleTos', handler: handler, config: { auth: { tos: 200 } } }
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

                expect(res.headers['WWW-Authenticate']).to.contain('Hawk');
                expect(res.headers['WWW-Authenticate']).to.contain('Basic');
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
                var header = res.headers['Set-Cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60000');
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
                var header = res.headers['Set-Cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60000');
                var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('logged-out');
                    expect(res.headers['Set-Cookie'][0]).to.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/');
                    done();
                });
            });
        });

        it('fails a request with invalid session', function (done) {

            server.inject({ method: 'GET', url: '/login/invalid' }, function (res) {

                expect(res.result).to.equal('invalid');
                var header = res.headers['Set-Cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Max-Age=60000');
                var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } }, function (res) {

                    expect(res.headers['Set-Cookie'][0]).to.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/');
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
                    expect(res.headers.Location).to.equal('http://example.com/login?next=%2F');
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
                    expect(res.headers.Location).to.equal('http://example.com/login?mode=1&next=%2F');
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