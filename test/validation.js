'use strict';

const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const Hapi = require('..');
const Inert = require('@hapi/inert');
const Joi = require('joi');
const JoiLegacy = require('@hapi/joi-legacy-test');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('validation', () => {

    it('validates using joi v15', async () => {

        const server = Hapi.server();
        server.validator(JoiLegacy);
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            options: {
                validate: {
                    payload: JoiLegacy.object({
                        a: JoiLegacy.number(),
                        b: JoiLegacy.array()
                    })
                }
            }
        });

        const res1 = await server.inject({ url: '/', method: 'POST', payload: { a: '1', b: [1] } });
        expect(res1.statusCode).to.equal(200);

        const res2 = await server.inject({ url: '/', method: 'POST', payload: { a: 'x', b: [1] } });
        expect(res2.statusCode).to.equal(400);
    });

    describe('inputs', () => {

        it('validates valid input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/b/{x}',
                handler: (request, h) => h.response(request.params.x + request.query.a),
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/{user?}',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);

            const scheme = function (authServer, options) {

                return {
                    authenticate: (request, h) => {

                        return h.authenticated({ credentials: { name: 'john' } });
                    }
                };
            };

            server.auth.scheme('none', scheme);
            server.auth.strategy('default', 'none');
            server.auth.default('default');

            server.route({
                method: 'GET',
                path: '/{user?}',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server({ routes: { validate: { options: { convert: false } } } });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: null
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
        });

        it('validates using custom validation', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.query.a,
                options: {
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

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: function (value, options) {

                            throw new Error('Bad query');
                        }
                    }
                }
            });

            const res = await server.inject('/?a=456');
            expect(res.statusCode).to.equal(400);
        });

        it('casts input to desired type', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/{seq}',
                handler: (request) => (request.params.seq + 1),
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/{seq}',
                handler: (request) => (request.orig.params.seq + 1),
                options: {
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

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: false
                    }
                }
            });

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(400);
        });

        it('retains the validation error', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: false,
                        failAction: (request, h, err) => err            // Expose detailed error
                    }
                }
            });

            server.ext('onPreResponse', (request) => request.response.details[0].path);

            const res = await server.inject('/?a=123');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(['a']);
        });

        it('validates valid input (Object root)', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: Joi.number()
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: '123', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(200);
        });

        it('validates boolean payload', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: Joi.boolean()
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: 'false', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(200);
        });

        it('fails on invalid input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(400);
        });

        it('ignores invalid input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server({ routes: { log: { collect: true } } });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.logs.filter((event) => event.tags[0] === 'validation')[0],
                options: {
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
            expect(res.result.error.output.payload.message).to.equal('Invalid request query input');
        });

        it('replaces error with message on invalid input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: function (request, h, err) {

                            return h.response('Got error in ' + err.output.payload.validation.source + ' where ' + err.output.payload.validation.keys[0] + ' is bad').code(400).takeover();
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(400);
            expect(res.result).to.equal('Got error in query where a is bad');
        });

        it('catches error thrown in failAction', async () => {

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        failAction: function (request, h, err) {

                            throw new Error('my bad');
                        }
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(500);
        });

        it('customizes error on invalid input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: {
                            a: Joi.string().min(2)
                        },
                        errorFields: {
                            walt: 'jr'
                        },
                        failAction: (request, h, err) => err            // Expose detailed error
                    }
                }
            });

            const res = await server.inject('/?a=1');
            expect(res.statusCode).to.equal(400);
            expect(res.result).to.equal({
                statusCode: 400,
                error: 'Bad Request',
                message: '"a" length must be at least 2 characters long',
                validation: {
                    source: 'query',
                    keys: ['a']
                },
                walt: 'jr'
            });
        });

        it('overrides connection level settings', async () => {

            const server = Hapi.server({
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

            server.validator(Joi);

            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok'
            });

            server.route({
                method: 'GET',
                path: '/other',
                handler: () => 'ok',
                options: {
                    validate: {
                        query: Joi.object({
                            b: Joi.string().required()
                        })
                    }
                }
            });

            const res1 = await server.inject({ url: '/', method: 'GET' });
            expect(res1.statusCode).to.equal(400);
            expect(res1.result.message).to.equal('Invalid request query input');

            const res2 = await server.inject({ url: '/?a=1', method: 'GET' });
            expect(res2.statusCode).to.equal(200);

            const res3 = await server.inject({ url: '/other', method: 'GET' });
            expect(res3.statusCode).to.equal(400);
            expect(res3.result.message).to.equal('Invalid request query input');

            const res4 = await server.inject({ url: '/other?b=1', method: 'GET' });
            expect(res4.statusCode).to.equal(200);
        });

        it('fails on invalid payload', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: {
                            a: Joi.string().min(8)
                        },
                        failAction: (request, h, err) => err            // Expose detailed error
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: (request) => request.payload,
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: {
                            a: Joi.string().min(2)
                        }
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/?a=1', payload: 'some text', headers: { 'content-type': 'text/plain' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.message).to.equal('Invalid request payload input');
        });

        it('fails on null input', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: {
                            a: Joi.string().required()
                        },
                        failAction: (request, h, err) => err            // Expose detailed error
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', payload: 'null', headers: { 'content-type': 'application/json' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation.source).to.equal('payload');
        });

        it('fails on no payload', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'POST',
                path: '/',
                handler: () => 'ok',
                options: {
                    validate: {
                        payload: {
                            a: Joi.string().required()
                        },
                        failAction: (request, h, err) => err            // Expose detailed error
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

        it('rejects invalid cookies', async () => {

            const server = Hapi.server({
                routes: {
                    validate: {
                        state: {
                            a: Joi.string().min(8)
                        },
                        failAction: (request, h, err) => err,           // Expose detailed error
                        validator: Joi
                    }
                }
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok'
            });

            const res = await server.inject({ method: 'GET', url: '/', headers: { 'cookie': 'a=abc' } });
            expect(res.statusCode).to.equal(400);
            expect(res.result.validation).to.equal({
                source: 'state',
                keys: ['a']
            });
        });

        it('accepts valid cookies', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.state,
                options: {
                    validate: {
                        state: {
                            a: Joi.string().min(8),
                            b: Joi.array().single().items(Joi.boolean()),
                            c: Joi.string().default('value')
                        },
                        failAction: (request, h, err) => err            // Expose detailed error
                    }
                }
            });

            const res = await server.inject({ method: 'GET', url: '/', headers: { 'cookie': 'a=abcdefghi; b=true' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({
                a: 'abcdefghi',
                b: [true],
                c: 'value'
            });
        });

        it('accepts all cookies', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.state,
                options: {
                    validate: {
                        state: true
                    }
                }
            });

            const res = await server.inject({ method: 'GET', url: '/', headers: { 'cookie': 'a=abc' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ a: 'abc' });
        });

        it('rejects all cookies', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.state,
                options: {
                    validate: {
                        state: false
                    }
                }
            });

            const res = await server.inject({ method: 'GET', url: '/', headers: { 'cookie': 'a=abc' } });
            expect(res.statusCode).to.equal(400);
        });

        it('validates valid header', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok',
                options: {
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

            const server = Hapi.server();

            const context = { valid: ['foo', 'bar'] };
            server.bind(context);

            server.route({
                method: 'GET',
                path: '/{val}',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    response: {
                        schema: Joi.object({
                            some: Joi.string(),
                            more: Joi.string()
                        })
                            .when('$query.user', { not: 'admin', then: Joi.object({ more: Joi.forbidden() }) })
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.query.x,
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

        it('throws on sample with response modify', () => {

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            expect(() => {

                server.route({
                    method: 'GET',
                    path: '/',
                    options: {
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
            }).to.throw(/"response.sample" is not allowed/);
        });

        it('do not throws on sample with false response modify', () => {

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            expect(() => {

                server.route({
                    method: 'GET',
                    path: '/',
                    config: {
                        response: {
                            schema: Joi.object({
                                a: Joi.number()
                            }).options({ stripUnknown: true }),
                            modify: false,
                            sample: 90
                        }
                    },
                    handler: () => ({ a: 1, b: 2 })
                });
            }).to.not.throw();
        });

        it('validates response using custom validation function', async () => {

            let i = 0;

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
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
            expect(res2.statusCode).to.equal(204);
            expect(res2.result).to.equal(null);

            const res3 = await server.inject('/');
            expect(res3.statusCode).to.equal(500);
        });

        it('catches error thrown by custom validation function', async () => {

            let i = 0;

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false, routes: { response: { options: { convert: false } } } });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => ({ a: '1' }),
                    response: {
                        schema: true
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('skips response validation when a status schema is true', async () => {

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request, h) => h.redirect('/somewhere'),
                    response: {
                        schema: false,
                        status: {
                            302: true
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });

        it('skips response validation when status is empty', async () => {

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            await server.register(Inert);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: 'log',
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

                if (tags.validation) {
                    expect(event.error.message).to.equal('"a" is not allowed');
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('replaces error with message on invalid response', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: function (request, h, err) {

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

        it('combines onPreResponse with response validation override', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.ext('onPreResponse', () => 'else');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: function (request, h, err) {

                            return h.response('something');
                        },
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('else');
        });

        it('combines onPreResponse with response validation override takeover', async () => {

            const server = Hapi.server();
            server.validator(Joi);
            server.ext('onPreResponse', () => 'else');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => ({ a: '1' }),
                    response: {
                        failAction: function (request, h, err) {

                            return h.response('something').takeover();
                        },
                        schema: {
                            b: Joi.string()
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('else');
        });

        it('combines onPreResponse with response validation error', async () => {

            const server = Hapi.server();

            const responses = [];

            server.ext('onPreResponse', (request, h) => {

                responses.push(request.response);
                return h.continue;
            });

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => {

                        const err = Boom.internal('handler error');
                        err.output.payload.x = 1;
                        throw err;
                    },
                    response: {
                        status: {
                            500: (value, options) => {

                                responses.push(value);
                                throw new Error('500 validation error');
                            }
                        },
                        failAction: (request, h, err) => {

                            responses.push(err);
                            throw new Error('failAction error');
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);

            expect(responses).to.have.length(3);
            expect(responses[0].x).to.equal(1);
            expect(responses[1]).to.be.an.error('500 validation error');
        });

        it('validates string response', async () => {

            let value = 'abcd';

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server({ debug: false });
            server.validator(Joi);
            server.route({
                method: 'GET',
                path: '/',
                options: {
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
    });
});
