// Load modules

var Lab = require('lab');
var Querystring = require('querystring');
var Path = require('path');
var Hapi = require('..');
var Response = require('../lib/response');
var Validation = require('../lib/validation');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Validation', function () {

    it('validates valid input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    }
                }
            }
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('validates using custom validator', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: function (value, options, next) {

                        return next(value.a === '123' ? null : new Error('Bad query'));
                    }
                }
            }
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(200);

            server.inject('/?a=456', function (res) {

                expect(res.statusCode).to.equal(400);
                expect(res.result.message).to.equal('Bad query');
                done();
            });
        });
    });

    it('casts input to desired type', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/{seq}',
            handler: function (request, reply) { reply(request.params.seq + 1); },
            config: {
                validate: {
                    path: {
                        seq: Hapi.types.number()
                    }
                }
            }
        });

        server.inject('/10', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(11)
            done();
        });
    });

    it('does not cast input to desired type when modify set to false', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/{seq}',
            handler: function (request, reply) { reply(request.params.seq + 1); },
            config: {
                validate: {
                    path: {
                        seq: Hapi.types.number().options({ modify: false })
                    }
                }
            }
        });

        server.inject('/10', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('101')
            done();
        });
    });

    it('invalidates forbidden input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: false
                }
            }
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('validates valid input (Object root)', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: Hapi.types.object({
                        a: Hapi.types.string().min(2)
                    })
                }
            }
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('fails on invalid input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    }
                }
            }
        });

        server.inject('/?a=1', function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.deep.equal({
                source: 'query',
                keys: ['a']
            });

            done();
        });
    });

    it('ignores on invalid input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    },
                    failAction: 'ignore'
                }
            }
        });

        server.inject('/?a=1', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('logs on invalid input', function (done) {

        var handler = function (request, reply) {

            var item = request.getLog('validation')[0];
            reply(item);
        };

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: handler,
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    },
                    failAction: 'log'
                }
            }
        });

        server.inject('/?a=1', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result.data.output.payload.message).to.deep.equal('the length of a must be at least 2 characters long');
            done();
        });
    });

    it('replaces error with message on invalid input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    },
                    failAction: function (source, error, next) {

                        next('Got error in ' + source + ' where ' + error.output.payload.validation.keys[0] + ' is bad');
                    }
                }
            }
        });

        server.inject('/?a=1', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('Got error in query where a is bad');
            done();
        });
    });

    it('customizes error on invalid input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: {
                        a: Hapi.types.string().min(2)
                    },
                    errorFields: {
                        walt: 'jr'
                    }
                }
            }
        });

        server.inject('/?a=1', function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result).to.deep.equal({
                statusCode: 400,
                error: 'Bad Request',
                message: 'the length of a must be at least 2 characters long',
                validation: {
                    source: 'query',
                    keys: ['a']
                },
                walt: 'jr'
            });

            done();
        });
    });

    it('fails on text input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    payload: {
                        a: Hapi.types.string().min(2)
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/?a=1', payload: 'some text', headers: { 'content-type': 'text/plain' } }, function (res) {

            expect(res.statusCode).to.equal(415);
            done();
        });
    });

    it('fails on null input', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    payload: {
                        a: Hapi.types.string().required()
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/', payload: 'null', headers: { 'content-type': 'application/json' } }, function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation.source).to.equal('payload')
            done();
        });
    });

    it('fails on no payload', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    payload: {
                        a: Hapi.types.string().required()
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/' }, function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.deep.equal({
                source: 'payload',
                keys: ['a']
            });

            done();
        });
    });

    var testHandler = function (hapi, reply) {

        reply('ohai');
    };

    var createRequestObject = function (query, route, payload) {

        var qstr = Querystring.stringify(query);
        var routeClone = Hapi.utils.clone(route);

        return {
            url: {
                search: '?' + qstr,
                query: query,
                pathname: routeClone.path,
                path: routeClone.path + '?' + qstr,//'/config?choices=1&choices=2',
                href: routeClone.path + '?' + qstr //'/config?choices=1&choices=2'
            },
            query: query,
            payload: payload,
            path: routeClone.path,
            method: routeClone.method,
            route: routeClone.config,
            server: {
                settings: {}
            },
            log: function () { }
        };
    };

    var createRequestObjectFromPath = function (path, params, route) {

        var routeClone = Hapi.utils.clone(route);

        return {
            url: {
                pathname: path,
                path: path,
                href: path
            },
            params: params,
            method: routeClone.method,
            route: routeClone.config,
            server: {
                settings: {}
            },
            log: function () { }
        };
    };

    describe('#response', function () {

        var route = { method: 'GET', path: '/', config: { handler: testHandler, response: { schema: { username: Hapi.types.string().required() } } } };

        it('should not raise an error when responding with valid param', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);

            request.response = Response.wrap({ username: 'test' }, request);

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('an error response should skip response validation and not return an error', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);

            request.response = Response.wrap(Hapi.error.unauthorized('You are not authorized'), request);

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with invalid param', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.response = Response.wrap({ wrongParam: 'test' }, request);

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('should raise an error when responding with invalid param and sample is 100', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.sample = 100;
            request.response = Response.wrap({ wrongParam: 'test' }, request);

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        internals.calculateFailAverage = function (size, sample) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.failAction = 'log';
            request.route.response.sample = sample;
            request.response = Response.wrap({ wrongParam: 'test' }, request);
            var failureCount = 0;

            request.log = function () {

                failureCount++;
            };

            var validationResponse = function () { };

            for (var i = size; i > 0; i--) {
                Validation.response(request, validationResponse);
            }

            return (failureCount / size) * 100;
        };

        it('sample percentage results in correct fail rate', function (done) {

            var rates = [];

            for (var i = 50; i > 0; i--) {                                  // Try 50 times and take the max and min
                rates.push(internals.calculateFailAverage(100, 25));
            }

            rates = rates.sort(function (a, b) {

                return a - b;
            });

            expect(rates[0]).to.be.greaterThan(8);                          // accept a 15 point margin
            expect(rates[49]).to.be.lessThan(45);

            done();
        });

        it('should report an error when responding with invalid response param and failAction is report', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.failAction = 'log';
            request.response = Response.wrap({ username: 'a', wrongParam: 'test' }, request);

            request.log = function (tags, data) {

                expect(data).to.contain('not allowed');
                done();
            };

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
            });
        });

        it('should raise an error when validating a non-object response', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.response = Response.wrap('test', request);

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    describe('#path', function () {

        var route = { method: 'GET', path: '/{id}', config: { handler: testHandler, validate: { path: { id: Hapi.types.number().required() } } } };

        it('should not raise an error when responding with valid param in the path', function (done) {

            var request = createRequestObjectFromPath('/21', { id: 21 }, route);

            Validation.path(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid path param', function (done) {

            var request = createRequestObjectFromPath('/test', { id: 'test', something: true }, route);

            Validation.path(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    describe('#query', function () {

        it('should not raise an error when responding with valid param in the querystring', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { query: { username: Hapi.types.string().min(7) } } } };
            var query = { username: 'username' };
            var request = createRequestObject(query, route);

            Validation.query(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid querystring param', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { query: { username: Hapi.types.string().min(7) } } } };
            var query = { username: '1' };
            var request = createRequestObject(query, route);

            Validation.query(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    describe('#payload', function () {

        it('should not raise an error when responding with valid param in the payload', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { payload: { username: Hapi.types.string().min(7) } } } };
            var payload = { username: 'username' };
            var request = createRequestObject(null, route, payload);

            Validation.payload(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid payload param', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { payload: { username: Hapi.types.string().required() } } } };
            var payload = { username: '' };
            var request = createRequestObject(null, route, payload);

            Validation.payload(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });
});