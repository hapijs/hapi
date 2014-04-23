// Load modules

var Async = require('async');
var Lab = require('lab');
var Joi = require('joi');
var Hapi = require('..');


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
                        a: Joi.string().min(2)
                    }
                }
            }
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('allows any input when set to null', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) { reply('ok'); },
            config: {
                validate: {
                    query: null
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
                        seq: Joi.number()
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
                        seq: Joi.number().options({ modify: false })
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

    it('retains the validation error', function (done) {

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

        server.ext('onPreResponse', function (request, reply) {

            reply(request.response.data.details[0].path);
        });

        server.inject('/?a=123', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('a');
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
                    query: Joi.object({
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().min(2)
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
                        a: Joi.string().required()
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
                        a: Joi.string().required()
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

    it('samples responses', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    reply({ a: 1});
                },
                response: {
                    sample: 50,
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        var count = 0;
        Async.times(500, function (n, next) {

            server.inject('/', function (res) {

                count += (res.statusCode === 500 ? 1 : 0);
                next(null, res.statusCode);
            });
        }, function (err, codes) {

            expect(count).to.be.within(200, 300);
            done();
        });
    });

    it('skips response validation when sample is zero', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    reply({ a: 1 });
                },
                response: {
                    sample: 0,
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        var count = 0;
        Async.times(500, function (n, next) {

            server.inject('/', function (res) {

                count += (res.statusCode === 500 ? 1 : 0);
                next(null, res.statusCode);
            });
        }, function (err, codes) {

            expect(count).to.equal(0);
            done();
        });
    });

    it('ignores error responses', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    reply(Hapi.error.badRequest());
                },
                response: {
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('errors on non-plain-object responses', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    reply.file('./package.json');
                },
                response: {
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('logs invalid responses', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    reply({ a: 1 });
                },
                response: {
                    failAction: 'log',
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.on('request', function (request, event, tags) {

            if (tags.validation) {
                expect(event.data).to.equal('the key a is not allowed');
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });
});