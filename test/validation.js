'use strict';

// Load modules

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('validation', () => {

    it('validates valid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number()
                    }
                }
            }
        });

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('validates both params and query', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/b/{x}',
            handler: function (request, reply) {

                return reply(request.params.x + request.query.a);
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number().integer().min(0).default(0)
                    },
                    params: {
                        x: Joi.number()
                    }
                }
            }
        });

        server.inject('/b/456?a=123', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(579);
            done();
        });
    });

    it('validates valid input using context', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/{user?}',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        verbose: Joi.boolean().truthy('true').when('$params.user', { is: Joi.exist(), otherwise: Joi.forbidden() })
                    }
                }
            }
        });

        server.inject('/?verbose=true', (res1) => {

            expect(res1.statusCode).to.equal(400);

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(200);

                server.inject('/steve?verbose=true', (res3) => {

                    expect(res3.statusCode).to.equal(200);

                    server.inject('/steve?verbose=x', (res4) => {

                        expect(res4.statusCode).to.equal(400);
                        done();
                    });
                });
            });
        });
    });

    it('validates valid input using auth context', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const scheme = function (authServer, options) {

            return {
                authenticate: function (request, reply) {

                    return reply.continue({ credentials: { name: 'john' } });
                }
            };
        };

        server.auth.scheme('none', scheme);

        server.auth.strategy('default', 'none', true);

        server.route({
            method: 'GET',
            path: '/{user?}',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        me: Joi.boolean().truthy('true').when('$auth.credentials.name', { is: Joi.ref('$params.user'), otherwise: Joi.forbidden() })
                    }
                }
            }
        });

        server.inject('/?me=true', (res1) => {

            expect(res1.statusCode).to.equal(400);

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(200);

                server.inject('/steve?me=true', (res3) => {

                    expect(res3.statusCode).to.equal(400);

                    server.inject('/john?me=true', (res4) => {

                        expect(res4.statusCode).to.equal(200);

                        server.inject('/john?me=x', (res5) => {

                            expect(res5.statusCode).to.equal(400);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('validates valid input using app context', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        x: Joi.ref('$app.route.some')
                    }
                },
                app: {
                    some: 'b'
                }
            }
        });

        server.inject('/?x=a', (res1) => {

            expect(res1.statusCode).to.equal(400);

            server.inject('/?x=b', (res2) => {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('fails valid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number()
                    }
                }
            }
        });

        server.inject('/?a=abc', (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('retains custom validation error', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number().error(Boom.forbidden())
                    }
                }
            }
        });

        server.inject('/?a=abc', (res) => {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('validates valid input with validation options', (done) => {

        const server = new Hapi.Server();
        server.connection({ routes: { validate: { options: { convert: false } } } });
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number()
                    }
                }
            }
        });

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('allows any input when set to null', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: null
                }
            }
        });

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('validates using custom validation', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: function (value, options, next) {

                        return next(value.a === '123' ? null : new Error('Bad query'));
                    }
                }
            }
        });

        server.inject('/?a=123', (res1) => {

            expect(res1.statusCode).to.equal(200);

            server.inject('/?a=456', (res2) => {

                expect(res2.statusCode).to.equal(400);
                expect(res2.result.message).to.equal('Bad query');
                done();
            });
        });
    });

    it('catches error thrown in custom validation', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: function (value, options, next) {

                        throw new Error('Bad query');
                    }
                }
            }
        });

        server.inject('/?a=456', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('casts input to desired type', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/{seq}',
            handler: function (request, reply) {

                return reply(request.params.seq + 1);
            },
            config: {
                validate: {
                    params: {
                        seq: Joi.number()
                    }
                }
            }
        });

        server.inject('/10', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(11);
            done();
        });
    });

    it('uses original value before schema conversion', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/{seq}',
            handler: function (request, reply) {

                return reply(request.orig.params.seq + 1);
            },
            config: {
                validate: {
                    params: {
                        seq: Joi.number()
                    }
                }
            }
        });

        server.inject('/10', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('101');
            done();
        });
    });

    it('invalidates forbidden input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: false
                }
            }
        });

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('retains the validation error', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: false
                }
            }
        });

        const preResponse = function (request, reply) {

            return reply(request.response.data.details[0].path);
        };

        server.ext('onPreResponse', preResponse);

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(['a']);
            done();
        });
    });

    it('validates valid input (Object root)', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: Joi.object({
                        a: Joi.string().min(2)
                    })
                }
            }
        });

        server.inject('/?a=123', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('validates non-object payload', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: Joi.number()
                }
            }
        });

        server.inject({ method: 'POST', url: '/', payload: '123', headers: { 'content-type': 'application/json' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('validates boolean payload', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: Joi.boolean()
                }
            }
        });

        server.inject({ method: 'POST', url: '/', payload: 'false', headers: { 'content-type': 'application/json' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('fails on invalid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.string().min(2)
                    }
                }
            }
        });

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'query',
                keys: ['a']
            });

            done();
        });
    });

    it('fails on invalid input (with joi 11 error)', (done) => {

        // Fake the joi 11 format
        const joiFakeError = new Error();
        joiFakeError.details = [{ path: ['foo', 'bar'] }];

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number().error(joiFakeError)
                    }
                }
            }
        });

        server.inject('/?a=abc', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'query',
                keys: ['foo.bar']
            });
            done();
        });
    });

    it('fails on invalid input (with joi 11 error and path string)', (done) => {
        // Fake the joi 11 format
        const joiFakeError = new Error();
        joiFakeError.details = [{ path: 'foo' }];

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.number().error(joiFakeError)
                    }
                }
            }
        });

        server.inject('/?a=abc', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'query',
                keys: ['foo']
            });
            done();
        });
    });

    it('ignores invalid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.string().min(2)
                    },
                    failAction: 'ignore'
                }
            }
        });

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('logs invalid input', (done) => {

        const handler = function (request, reply) {

            const item = request.getLog('validation')[0];
            return reply(item);
        };

        const server = new Hapi.Server();
        server.connection({ routes: { log: true } });
        server.route({
            method: 'GET',
            path: '/',
            handler,
            config: {
                validate: {
                    query: {
                        a: Joi.string().min(2)
                    },
                    failAction: 'log'
                }
            }
        });

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result.data.output.payload.message).to.equal('child "a" fails because ["a" length must be at least 2 characters long]');
            done();
        });
    });

    it('replaces error with message on invalid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.string().min(2)
                    },
                    failAction: function (request, reply, source, error) {

                        return reply('Got error in ' + source + ' where ' + error.output.payload.validation.keys[0] + ' is bad').code(400);
                    }
                }
            }
        });

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result).to.equal('Got error in query where a is bad');
            done();
        });
    });

    it('catches error thrown in failAction', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    query: {
                        a: Joi.string().min(2)
                    },
                    failAction: function (request, reply, source, error) {

                        throw new Error('my bad');
                    }
                }
            }
        });

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('customizes error on invalid input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
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

        server.inject('/?a=1', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result).to.equal({
                statusCode: 400,
                error: 'Bad Request',
                message: 'child "a" fails because ["a" length must be at least 2 characters long]',
                validation: {
                    source: 'query',
                    keys: ['a']
                },
                walt: 'jr'
            });

            done();
        });
    });

    it('overrides connection level settings', (done) => {

        const server = new Hapi.Server();
        server.connection({
            routes: {
                validate: {
                    query: Joi.object({
                        a: Joi.string().required()
                    }),
                    options: {
                        abortEarly: false
                    }
                }
            }
        });

        const handler = function (request, reply) {

            return reply('ok');
        };

        server.route({
            method: 'GET',
            path: '/',
            handler
        });

        server.route({
            method: 'GET',
            path: '/other',
            handler,
            config: {
                validate: {
                    query: Joi.object({
                        b: Joi.string().required()
                    })
                }
            }
        });

        server.inject({ url: '/', method: 'GET' }, (res1) => {

            expect(res1.statusCode).to.equal(400);
            expect(res1.result.message).to.equal('child "a" fails because ["a" is required]');

            server.inject({ url: '/?a=1', method: 'GET' }, (res2) => {

                expect(res2.statusCode).to.equal(200);

                server.inject({ url: '/other', method: 'GET' }, (res3) => {

                    expect(res3.statusCode).to.equal(400);
                    expect(res3.result.message).to.equal('child "b" fails because ["b" is required]');

                    server.inject({ url: '/other?b=1', method: 'GET' }, (res4) => {

                        expect(res4.statusCode).to.equal(200);
                        done();
                    });
                });
            });
        });
    });

    it('fails on invalid payload', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: {
                        a: Joi.string().min(8)
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/', payload: '{"a":"abc"}', headers: { 'content-type': 'application/json' } }, (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'payload',
                keys: ['a']
            });

            done();
        });
    });

    it('converts string input to number', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply(request.payload);
            },
            config: {
                validate: {
                    payload: Joi.number()
                }
            }
        });

        server.inject({ method: 'POST', url: '/?a=1', payload: '123', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(123);
            done();
        });
    });

    it('fails on text input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: {
                        a: Joi.string().min(2)
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/?a=1', payload: 'some text', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.message).to.equal('"value" must be an object');
            done();
        });
    });

    it('fails on null input', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: {
                        a: Joi.string().required()
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/', payload: 'null', headers: { 'content-type': 'application/json' } }, (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation.source).to.equal('payload');
            done();
        });
    });

    it('fails on no payload', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    payload: {
                        a: Joi.string().required()
                    }
                }
            }
        });

        server.inject({ method: 'POST', url: '/' }, (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'payload',
                keys: ['']
            });

            done();
        });
    });

    it('samples responses', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    sample: 50,
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        let count = 0;
        const action = function (next) {

            server.inject('/', (res) => {

                count += (res.statusCode === 500 ? 1 : 0);
                return next(null, res.statusCode);
            });
        };

        internals.times(500, action, (err, codes) => {

            expect(err).to.not.exist();
            expect(count).to.be.within(200, 300);
            done();
        });
    });

    it('validates response', (done) => {

        let i = 0;
        const handler = function (request, reply) {

            return reply({ some: i++ ? null : 'value' });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: {
                        some: Joi.string()
                    }
                }
            },
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('{"some":"value"}');

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(500);
                done();
            });
        });
    });

    it('validates response with context', (done) => {

        const handler = function (request, reply) {

            return reply({ some: 'thing', more: 'stuff' });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: Joi.object({
                        some: Joi.string(),
                        more: Joi.string()
                    }).when('$query.user', { is: 'admin', otherwise: Joi.object({ more: Joi.forbidden() }) })
                }
            },
            handler
        });

        server.inject('/?user=admin', (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('{"some":"thing","more":"stuff"}');

            server.inject('/?user=test', (res2) => {

                expect(res2.statusCode).to.equal(500);
                done();
            });
        });
    });

    it('validates response using app context', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply(request.query.x);
            },
            config: {
                response: {
                    schema: Joi.valid(Joi.ref('$app.route.some'))
                },
                app: {
                    some: 'b'
                }
            }
        });

        server.inject('/?x=a', (res1) => {

            expect(res1.statusCode).to.equal(500);

            server.inject('/?x=b', (res2) => {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('validates error response', (done) => {

        let i = 0;
        const handler = function (request, reply) {

            const error = Boom.badRequest('Kaboom');
            error.output.payload.custom = i++;
            return reply(error);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    status: {
                        400: {
                            statusCode: Joi.number(),
                            error: Joi.string(),
                            message: Joi.string(),
                            custom: 0
                        }
                    }
                }
            },
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(400);
            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(500);
                done();
            });
        });
    });

    it('validates error response and ignore 200', (done) => {

        let i = 0;
        const handler = function (request, reply) {

            if (i === 0) {
                ++i;
                return reply({ a: 1, b: 2 });
            }

            const error = Boom.badRequest('Kaboom');
            error.output.payload.custom = i++;
            return reply(error);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: true,
                    status: {
                        400: {
                            statusCode: Joi.number(),
                            error: Joi.string(),
                            message: Joi.string(),
                            custom: 1
                        }
                    }
                }
            },
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(200);
            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(400);
                server.inject('/', (res3) => {

                    expect(res3.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });

    it('validates and modifies response', (done) => {

        const handler = function (request, reply) {

            return reply({ a: 1, b: 2 });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: Joi.object({
                        a: Joi.number()
                    }).options({ stripUnknown: true }),
                    modify: true
                }
            },
            handler
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ a: 1 });
            done();
        });
    });

    it('validates and modifies error response', (done) => {

        const handler = function (request, reply) {

            const error = Boom.badRequest('Kaboom');
            error.output.payload.custom = '123';
            return reply(error);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    status: {
                        400: {
                            statusCode: Joi.number(),
                            error: Joi.string(),
                            message: Joi.string(),
                            custom: Joi.number()
                        }
                    },
                    modify: true
                }
            },
            handler
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result.custom).to.equal(123);
            done();
        });
    });

    it('validates empty response', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    status: {
                        204: false
                    }
                },
                handler: function (request, reply) {

                    reply().code(204);
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(204);
            done();
        });
    });

    it('throws on sample with response modify', (done) => {

        const handler = function (request, reply) {

            return reply({ a: 1, b: 2 });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        expect(() => {

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: Joi.object({
                            a: Joi.number()
                        }).options({ stripUnknown: true }),
                        modify: true,
                        sample: 90
                    }
                },
                handler
            });
        }).to.throw(/"modify" conflict with forbidden peer "sample"/);
        done();
    });

    it('validates response using custom validation function', (done) => {

        let i = 0;
        const handler = function (request, reply) {

            return reply({ some: i++ ? null : 'value' });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
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
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('{"some":"value"}');

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(500);
                done();
            });
        });
    });

    it('catches error thrown by custom validation function', (done) => {

        let i = 0;
        const handler = function (request, reply) {

            return reply({ some: i++ ? null : 'value' });
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: function (value, options, next) {

                        throw new Error('Bad response');
                    }
                }
            },
            handler
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('skips response validation when sample is zero', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    sample: 0,
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        let count = 0;
        const action = function (next) {

            server.inject('/', (res) => {

                count += (res.statusCode === 500 ? 1 : 0);
                return next(null, res.statusCode);
            });
        };

        internals.times(500, action, (err, codes) => {

            expect(err).to.not.exist();
            expect(count).to.equal(0);
            done();
        });
    });

    it('does not delete the response object from the route when sample is 0', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply('ok');
                },
                response: {
                    sample: 0,
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.request.route.settings.response).to.exist();
            expect(res.request.route.settings.response.sample).to.equal(0);
            expect(res.request.route.settings.response.schema).to.exist();
            done();
        });
    });

    it('fails response validation with options', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection({ routes: { response: { options: { convert: false } } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: '1' });
                },
                response: {
                    schema: {
                        a: Joi.number()
                    }
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('skips response validation when schema is true', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    schema: true
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('skips response validation when status is empty', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    status: {}
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('forbids response when schema is false', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    schema: false
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('ignores error responses', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply(Boom.badRequest());
                },
                response: {
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('errors on non-plain-object responses', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.register(Inert, Hoek.ignore);
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply.file('./package.json');
                },
                response: {
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('logs invalid responses', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    failAction: 'log',
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.on('request-internal', (request, event, tags) => {

            if (tags.validation) {
                expect(event.data).to.equal('"a" is not allowed');
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('replaces error with message on invalid response', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    return reply({ a: 1 });
                },
                response: {
                    failAction: function (request, reply, error) {

                        return reply('Validation Error Occurred').code(400);
                    },
                    schema: {
                        b: Joi.string()
                    }
                }
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.payload).to.equal('Validation Error Occurred');
            done();
        });
    });



    it('validates string response', (done) => {

        let value = 'abcd';
        const handler = function (request, reply) {

            return reply(value);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: Joi.string().min(5)
                }
            },
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(500);
            value += 'e';

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(200);
                expect(res2.payload).to.equal('abcde');
                done();
            });
        });
    });

    it('validates boolean response', (done) => {

        let value = 'abcd';
        const handler = function (request, reply) {

            return reply(value);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                response: {
                    schema: Joi.boolean().truthy('on'),
                    modify: true
                }
            },
            handler
        });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(500);
            value = 'on';

            server.inject('/', (res2) => {

                expect(res2.statusCode).to.equal(200);
                expect(res2.payload).to.equal('true');
                done();
            });
        });
    });

    it('validates valid header', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    headers: {
                        host: server.info.host + ':' + server.info.port,
                        accept: Joi.string().valid('application/json').required(),
                        'user-agent': Joi.string().optional()
                    }
                }
            }
        });

        const settings = {
            url: '/',
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        };

        server.inject(settings, (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('rejects invalid header', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply('ok');
            },
            config: {
                validate: {
                    headers: {
                        accept: Joi.string().valid('text/html').required(),
                        'user-agent': Joi.string().optional()
                    }
                }
            }
        });

        const settings = {
            url: '/',
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        };

        server.inject(settings, (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('throws on options.stripUnknown without modify', (done) => {

        const server = new Hapi.Server();
        server.connection();

        expect(() => {

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('ok');
                },
                config: {
                    response: {
                        schema: Joi.string(),
                        options: {
                            stripUnknown: true
                        }
                    }
                }
            });
        }).to.throw(/"options.stripUnknown" failed to meet requirement of having peer modify set to true/);

        done();
    });

    it('allows options.stripUnknown to be an object', (done) => {

        const server = new Hapi.Server();
        server.connection();

        expect(() => {

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('ok');
                },
                config: {
                    response: {
                        schema: Joi.string(),
                        modify: true,
                        options: {
                            stripUnknown: {
                                objects: true,
                                arrays: true
                            }
                        }
                    }
                }
            });
        }).to.not.throw();

        done();
    });

    it('binds route validate function to a context', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const context = { valid: ['foo', 'bar'] };
        server.bind(context);

        server.route({
            method: 'GET',
            path: '/{val}',
            config: {
                validate: {
                    params: function (value, options, next) {

                        next(this.valid.indexOf(value) === -1, value);
                    }
                },
                handler: function (request, reply) {

                    return reply('ok');
                }
            }
        });

        server.inject('/baz', (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });
});


internals.times = function (count, method, callback) {

    let counter = 0;

    const results = [];
    const done = function (err, result) {

        if (callback) {
            results.push(result);
            if (err) {
                callback(err);
                callback = null;
            }
            else {
                counter += 1;
                if (counter === count) {
                    callback(null, results);
                }
            }
        }
    };

    for (let i = 0; i < count; ++i) {
        method(done);
    }
};
