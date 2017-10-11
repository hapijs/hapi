'use strict';

// Load modules

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Inert = require('inert');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('validation', () => {

    describe('inputs', () => {

        it('validates valid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
        });

        it('validates both params and query', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/b/{x}',
                handler: (request, h) => h.response(request.params.x + request.query.a),
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

            const res = await server.inject('/b/456?a=123');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(579);
        });

        it('validates valid input using context', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/{user?}',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            verbose: Joi.boolean().truthy('true').when('$params.user', { is: Joi.exist(), otherwise: Joi.forbidden() })
                        }
                    }
                }
            });

            const res1 = await server.inject('/?verbose=true');
            expect(res1.statusCode).to.equal(400);

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);

            const res3 = await server.inject('/steve?verbose=true');
            expect(res3.statusCode).to.equal(200);

            const res4 = await server.inject('/steve?verbose=x');
            expect(res4.statusCode).to.equal(400);
        });

        it('validates valid input using auth context', async () => {

            const server = new Hapi.Server();

            const scheme = function (authServer, options) {

                return {
                    authenticate: (request, h) => {

                        return h.authenticated({ credentials: { name: 'john' } });
                    }
                };
            };

            server.auth.scheme('none', scheme);

            server.auth.strategy('default', 'none', true);

            server.route({
                method: 'GET',
                path: '/{user?}',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            me: Joi.boolean().truthy('true').when('$auth.credentials.name', { is: Joi.ref('$params.user'), otherwise: Joi.forbidden() })
                        }
                    }
                }
            });

            const res1 = await server.inject('/?me=true');
            expect(res1.statusCode).to.equal(400);

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);

            const res3 = await server.inject('/steve?me=true');
            expect(res3.statusCode).to.equal(400);

            const res4 = await server.inject('/john?me=true');
            expect(res4.statusCode).to.equal(200);

            const res5 = await server.inject('/john?me=x');
            expect(res5.statusCode).to.equal(400);
        });

        it('validates valid input using app context', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
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

            const res1 = await server.inject('/?x=a');
            expect(res1.statusCode).to.equal(400);

            const res2 = await server.inject('/?x=b');
            expect(res2.statusCode).to.equal(200);
        });

        it('fails valid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/?a=abc');
            expect(res.statusCode).to.equal(400);
        });

        it('retains custom validation error', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.number().error(Boom.forbidden())
                        }
                    }
                }
            });

            const res = await server.inject('/?a=abc');
            expect(res.statusCode).to.equal(403);
        });

        it('validates valid input with validation options', async () => {

            const server = new Hapi.Server({ routes: { validate: { options: { convert: false } } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(400);
        });

        it('allows any input when set to null', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: null
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
        });

        it('validates using custom validation', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.query.a,
                config: {
                    validate: {
                        query: function (value, options) {

                            if (value.a === 'skip') {
                                return;
                            }

                            if (value.a !== '123') {
                                throw Boom.badRequest('Bad query');
                            }

                            return { a: 'ok' };
                        }
                    }
                }
            });

            const res1 = await server.inject('/?a=123');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal('ok');

            const res2 = await server.inject('/?a=456');
            expect(res2.statusCode).to.equal(400);
            expect(res2.result.message).to.equal('Bad query');

            const res3 = await server.inject('/?a=123');
            expect(res3.statusCode).to.equal(200);
            expect(res3.result).to.equal('ok');
        });

        it('catches error thrown in custom validation', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: function (value, options) {

                            throw new Error('Bad query');
                        }
                    }
                }
            });

            const res = await server.inject('/?a=456');
            expect(res.statusCode).to.equal(500);
        });

        it('casts input to desired type', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/{seq}',
                handler: (request) => (request.params.seq + 1),
                config: {
                    validate: {
                        params: {
                            seq: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/10');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(11);
        });

        it('uses original value before schema conversion', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/{seq}',
                handler: (request) => (request.orig.params.seq + 1),
                config: {
                    validate: {
                        params: {
                            seq: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/10');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('101');
        });

        it('invalidates forbidden input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: false
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(400);
        });

        it('retains the validation error', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: false
                    }
                }
            });

            server.ext('onPreResponse', (request) => request.response.data.details[0].path);

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(['a']);
        });

        it('validates valid input (Object root)', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: Joi.object({
                            a: Joi.string().min(2)
                        })
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
        });

        it('validates non-object payload', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: Joi.number()
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: '123', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(200);
        });

        it('validates boolean payload', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: Joi.boolean()
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: 'false', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(200);
        });

        it('fails on invalid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'query',
                keys: ['a']
            });
        });

        it('ignores invalid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: 'ignore'
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(200);
        });

        it('logs invalid input', async () => {

            const server = new Hapi.Server({ routes: { log: { collect: true } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.getLog('validation')[0],
                config: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: 'log'
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(200);
            expect(res.result.data.output.payload.message).to.equal('child "a" fails because ["a" length must be at least 2 characters long]');
        });

        it('replaces error with message on invalid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: function (request, h, source, error) {

                            return h.response('Got error in ' + source + ' where ' + error.output.payload.validation.keys[0] + ' is bad').code(400);
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(400);
            expect(res.result).to.equal('Got error in query where a is bad');
        });

        it('catches error thrown in failAction', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: function (request, h, source, error) {

                            throw new Error('my bad');
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(500);
        });

        it('customizes error on invalid input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
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

            const res = await server.inject('/?a=1');
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
        });

        it('overrides connection level settings', async () => {

            const server = new Hapi.Server({
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

            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok'
            });

            server.route({
                method: 'GET',
                path: '/other',
                handler: () => 'ok',
                config: {
                    validate: {
                        query: Joi.object({
                            b: Joi.string().required()
                        })
                    }
                }
            });

            const res1 = await server.inject({ url: '/', method: 'GET' });
            expect(res1.statusCode).to.equal(400);
            expect(res1.result.message).to.equal('child "a" fails because ["a" is required]');

            const res2 = await server.inject({ url: '/?a=1', method: 'GET' });
            expect(res2.statusCode).to.equal(200);

            const res3 = await server.inject({ url: '/other', method: 'GET' });
            expect(res3.statusCode).to.equal(400);
            expect(res3.result.message).to.equal('child "b" fails because ["b" is required]');

            const res4 = await server.inject({ url: '/other?b=1', method: 'GET' });
            expect(res4.statusCode).to.equal(200);
        });

        it('fails on invalid payload', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: {
                            a: Joi.string().min(8)
                        }
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: '{"a":"abc"}', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'payload',
                keys: ['a']
            });
        });

        it('converts string input to number', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: (request) => request.payload,
                config: {
                    validate: {
                        payload: Joi.number()
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/?a=1', payload: '123', headers: { 'content-type': 'text/plain' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(123);
        });

        it('fails on text input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: {
                            a: Joi.string().min(2)
                        }
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/?a=1', payload: 'some text', headers: { 'content-type': 'text/plain' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.message).to.equal('"value" must be an object');
        });

        it('fails on null input', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: {
                            a: Joi.string().required()
                        }
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: 'null', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation.source).to.equal('payload');
        });

        it('fails on no payload', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                config: {
                    validate: {
                        payload: {
                            a: Joi.string().required()
                        }
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/' });
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'payload',
                keys: ['']
            });
        });

        it('validates valid header', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
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

            const res = await server.inject(settings);
            expect(res.statusCode).to.equal(200);
        });

        it('rejects invalid header', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
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

            const res = await server.inject(settings);
            expect(res.statusCode).to.equal(400);
        });

        it('binds route validate function to a context', async () => {

            const server = new Hapi.Server();

            const context = { valid: ['foo', 'bar'] };
            server.bind(context);

            server.route({
                method: 'GET',
                path: '/{val}',
                config: {
                    validate: {
                        params: function (value, options) {

                            if (this.valid.indexOf(value) === -1) {
                                throw Boom.badRequest();
                            }

                            return value;
                        }
                    },
                    handler: () => null
                }
            });

            const res = await server.inject('/baz');
            expect(res.statusCode).to.equal(400);
        });
    });

    describe('response', () => {

        it('samples responses', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: 1 }),
                    response: {
                        sample: 50,
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            let count = 0;
            const action = async function () {

                const res = await server.inject('/');
                count += (res.statusCode === 500 ? 1 : 0);
            };

            for (let i = 0; i < 500; ++i) {
                await action();
            }

            expect(count).to.be.within(200, 300);
        });

        it('validates response', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
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
                handler: () => ({ some: i++ ? null : 'value' })
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('{"some":"value"}');

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(500);
        });

        it('validates response with context', async () => {

            const server = new Hapi.Server({ debug: false });
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
                handler: () => ({ some: 'thing', more: 'stuff' })
            });

            const res1 = await server.inject('/?user=admin');
            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('{"some":"thing","more":"stuff"}');

            const res2 = await server.inject('/?user=test');
            expect(res2.statusCode).to.equal(500);
        });

        it('validates response using app context', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.query.x,
                config: {
                    response: {
                        schema: Joi.valid(Joi.ref('$app.route.some'))
                    },
                    app: {
                        some: 'b'
                    }
                }
            });

            const res1 = await server.inject('/?x=a');
            expect(res1.statusCode).to.equal(500);

            const res2 = await server.inject('/?x=b');
            expect(res2.statusCode).to.equal(200);
        });

        it('validates error response', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
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
                handler: () => {

                    const error = Boom.badRequest('Kaboom');
                    error.output.payload.custom = i++;
                    throw error;
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(400);

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(500);
        });

        it('validates error response and ignore 200', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
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
                handler: () => {

                    if (i === 0) {
                        ++i;
                        return { a: 1, b: 2 };
                    }

                    const error = Boom.badRequest('Kaboom');
                    error.output.payload.custom = i++;
                    throw error;
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(400);

            const res3 = await server.inject('/');

            expect(res3.statusCode).to.equal(500);
        });

        it('validates and modifies response', async () => {

            const server = new Hapi.Server({ debug: false });
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
                handler: () => ({ a: 1, b: 2 })
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ a: 1 });
        });

        it('validates and modifies error response', async () => {

            const server = new Hapi.Server({ debug: false });
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
                handler: () => {

                    const error = Boom.badRequest('Kaboom');
                    error.output.payload.custom = '123';
                    throw error;
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
            expect(res.result.custom).to.equal(123);
        });

        it('validates empty response', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        status: {
                            204: false
                        }
                    },
                    handler: (request, h) => h.response().code(204)
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
        });

        it('throws on sample with response modify', async () => {

            const server = new Hapi.Server({ debug: false });
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
                    handler: () => ({ a: 1, b: 2 })
                });
            }).to.throw(/"modify" conflict with forbidden peer "sample"/);
        });

        it('validates response using custom validation function', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: function (value, options) {

                            if (value.some === 'unchanged') {
                                return;
                            }

                            if (value.some === 'null') {
                                return null;
                            }

                            throw new Error('Bad response');
                        }
                    }
                },
                handler: () => {

                    ++i;
                    switch (i) {
                        case 1: return { some: 'unchanged' };
                        case 2: return { some: 'null' };
                        default: return { some: 'throw' };
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal({ some: 'unchanged' });

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal({ some: 'null' });

            const res3 = await server.inject('/');
            expect(res3.statusCode).to.equal(500);
        });

        it('validates response using custom validation function (modify)', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        modify: true,
                        schema: function (value, options) {

                            if (value.some === 'unchanged') {
                                return;
                            }

                            if (value.some === 'null') {
                                return null;
                            }

                            throw new Error('Bad response');
                        }
                    }
                },
                handler: () => {

                    ++i;
                    switch (i) {
                        case 1: return { some: 'unchanged' };
                        case 2: return { some: 'null' };
                        default: return { some: 'throw' };
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal({ some: 'unchanged' });

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal(null);

            const res3 = await server.inject('/');
            expect(res3.statusCode).to.equal(500);
        });

        it('catches error thrown by custom validation function', async () => {

            let i = 0;

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: function (value, options) {

                            throw new Error('Bad response');
                        }
                    }
                },
                handler: () => ({ some: i++ ? null : 'value' })
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('skips response validation when sample is zero', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: 1 }),
                    response: {
                        sample: 0,
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            let count = 0;
            const action = async function () {

                const res = await server.inject('/');
                count += (res.statusCode === 500 ? 1 : 0);
            };

            for (let i = 0; i < 500; ++i) {
                await action();
            }

            expect(count).to.equal(0);
        });

        it('does not delete the response object from the route when sample is 0', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => 'ok',
                    response: {
                        sample: 0,
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.request.route.settings.response).to.exist();
            expect(res.request.route.settings.response.sample).to.equal(0);
            expect(res.request.route.settings.response.schema).to.exist();
        });

        it('fails response validation with options', async () => {

            const server = new Hapi.Server({ debug: false, routes: { response: { options: { convert: false } } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        schema: {
                            a: Joi.number()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('skips response validation when schema is true', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        schema: true
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('skips response validation when status is empty', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        status: {}
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('forbids response when schema is false', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        schema: false
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('ignores error responses', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => {

                        throw Boom.badRequest();
                    },
                    response: {
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
        });

        it('errors on non-plain-object responses', async () => {

            const server = new Hapi.Server({ debug: false });
            await server.register(Inert);
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: (request, h) => h.file('./package.json'),
                    response: {
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('logs invalid responses', async () => {

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: 'log',
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            server.events.on('request-internal', (request, event, tags) => {

                if (tags.validation) {
                    expect(event.data).to.equal('"a" is not allowed');
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('replaces error with message on invalid response', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: function (request, h, error) {

                            return h.response('Validation Error Occurred').code(400);
                        },
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
            expect(res.payload).to.equal('Validation Error Occurred');
        });

        it('validates string response', async () => {

            let value = 'abcd';

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: Joi.string().min(5)
                    }
                },
                handler: () => value
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(500);
            value += 'e';

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.payload).to.equal('abcde');
        });

        it('validates boolean response', async () => {

            let value = 'abcd';

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    response: {
                        schema: Joi.boolean().truthy('on'),
                        modify: true
                    }
                },
                handler: () => value
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(500);
            value = 'on';

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.payload).to.equal('true');
        });

        it('throws on options.stripUnknown without modify', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: () => 'ok',
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
        });

        it('allows options.stripUnknown to be an object', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: () => 'ok',
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
        });
    });
});
