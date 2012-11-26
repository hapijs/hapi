// Load modules

var Chai = require('chai');
var Oz = require('oz');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Auth', function () {

    var basicHeader = function (username, password) {

        return 'Basic ' + (new Buffer(username + ':' + password, 'utf8')).toString('base64');
    };

    describe('Basic', function () {

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

        var config = {
            auth: {
                scheme: 'basic',
                loadUserFunc: loadUser
            }
        };

        var server = new Hapi.Server('0.0.0.0', 8080, config);

        var basicHandler = function (request) {

            request.reply('Success');
        };

        var doubleHandler = function (request) {

            var options = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('john', '12345') }, session: request.session };

            server.inject(options, function (res) {

                request.reply(res.result);
            });
        };

        server.addRoutes([
            { method: 'POST', path: '/basic', handler: basicHandler },
            { method: 'POST', path: '/basicOptional', handler: basicHandler, config: { auth: { mode: 'optional' } } },
            { method: 'POST', path: '/basicScope', handler: basicHandler, config: { auth: { scope: 'x' } } },
            { method: 'POST', path: '/basicTos', handler: basicHandler, config: { auth: { tos: 200 } } },
            { method: 'POST', path: '/double', handler: doubleHandler },
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

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });

        it('returns an error on bad password', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: basicHeader('john', 'abcd') } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad header format', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: 'junk' } };

            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(401);
                done();
            });
        });

        it('returns an error on bad scheme', function (done) {

            var request = { method: 'POST', url: '/basic', headers: { authorization: 'junk something' } };

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

        server.addRoutes([
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

            var request = { method: 'POST', url: '/ozOptional' };

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

    describe('Ext', function () {

        it('returns a reply on successful ext any', function (done) {

            var config = {
                auth: {
                    scheme: 'ext:any',
                    implementation: {

                        authenticate: function (request, next) {

                            next();
                        }
                    }
                }
            };

            var handler = function (request) {

                request.reply('Success');
            };

            var server = new Hapi.Server('0.0.0.0', 8080, config);
            server.addRoute({ method: 'POST', path: '/ext', handler: handler });

            var request = { method: 'POST', url: '/ext' };
            server.inject(request, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal('Success');
                done();
            });
        });
    });
});

