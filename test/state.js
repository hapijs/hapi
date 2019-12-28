'use strict';

const Code = require('@hapi/code');
const Hapi = require('..');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('state', () => {

    it('parses cookies', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: (request) => request.state });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'v=a' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result.v).to.equal('a');
        expect(res.headers['set-cookie']).to.not.exist();
    });

    it('sets a cookie value to a base64json string representation of an object', async () => {

        const server = Hapi.server();
        server.state('data', { encoding: 'base64json' });
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').state('data', { b: 3 }) });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['data=eyJiIjozfQ==; Secure; HttpOnly; SameSite=Strict']);
    });

    it('parses base64json cookies', async () => {

        const server = Hapi.server();
        server.state('data', { encoding: 'base64json' });
        server.route({ method: 'GET', path: '/', handler: (request) => request.state });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'data=eyJiIjozfQ==' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result.data).to.equal({ b: 3 });
    });

    it('skips parsing cookies', async () => {

        const server = Hapi.server({ routes: { state: { parse: false } } });
        server.route({ method: 'GET', path: '/', handler: (request) => (request.state === null) });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'v=a' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(true);
    });

    it('does not clear invalid cookie if cannot parse', async () => {

        const server = Hapi.server();
        server.state('vab', { encoding: 'base64json', clearInvalid: true });
        server.route({ method: 'GET', path: '/', handler: (request) => request.state });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'vab' } });
        expect(res.statusCode).to.equal(400);
        expect(res.headers['set-cookie']).to.not.exist();
    });

    it('ignores invalid cookies (state level config)', async () => {

        const server = Hapi.server({ routes: { log: { collect: true } } });
        server.state('a', { ignoreErrors: true, encoding: 'base64json' });
        server.route({ path: '/', method: 'GET', handler: (request) => request.logs.filter((event) => event.tags[0] === 'state').length });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'a=x' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(0);
    });

    it('ignores invalid cookies (header)', async () => {

        const server = Hapi.server({ routes: { state: { failAction: 'ignore' }, log: { collect: true } } });
        server.route({ path: '/', method: 'GET', handler: (request) => request.logs.filter((event) => event.tags[0] === 'state').length });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'a=x;;' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(0);
    });

    it('ignores invalid cookie using server.state() (header)', async () => {

        const server = Hapi.server({ routes: { log: { collect: true } } });
        server.state('a', { strictHeader: false });
        server.route({ path: '/', method: 'GET', handler: (request) => request.logs.filter((event) => event.tags[0] === 'state').length });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'a=x y;' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(0);
    });

    it('logs invalid cookie (value)', async () => {

        const server = Hapi.server({ routes: { state: { failAction: 'log' }, log: { collect: true } } });
        server.state('a', { encoding: 'base64json', clearInvalid: true });
        server.route({ path: '/', method: 'GET', handler: (request) => request.logs.filter((event) => event.tags[0] === 'state').length });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'a=x' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(1);
    });

    it('clears invalid cookies (state level config)', async () => {

        const server = Hapi.server();
        server.state('a', { ignoreErrors: true, encoding: 'base64json', clearInvalid: true });
        server.route({ path: '/', method: 'GET', handler: () => null });
        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'a=x' } });
        expect(res.statusCode).to.equal(204);
        expect(res.headers['set-cookie'][0]).to.equal('a=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict');
    });

    it('sets cookie value automatically', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });
        server.state('always', { autoValue: 'present' });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['always=present; Secure; HttpOnly; SameSite=Strict']);
    });

    it('does not set cookie value automatically when set by the handler', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').state('always', 'from-handler') });
        server.state('always', { autoValue: 'present' });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['always=from-handler; Secure; HttpOnly; SameSite=Strict']);
    });

    it('does not set cookie value automatically when cookie received from the client', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });
        server.state('always', { autoValue: 'present' });

        const res = await server.inject({ method: 'GET', url: '/', headers: { cookie: 'always=from-client' } });
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.not.exist();
    });

    it('appends handler set-cookie to server state', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response().header('set-cookie', ['onecookie=yes', 'twocookie=no']) });
        server.state('always', { autoValue: 'present' });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(204);
        expect(res.headers['set-cookie']).to.equal(['onecookie=yes', 'twocookie=no', 'always=present; Secure; HttpOnly; SameSite=Strict']);
    });

    it('sets cookie value automatically using function', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/{x}', handler: () => 'ok' });
        server.state('always', { autoValue: (request) => Promise.resolve(request.params.x) });

        const res = await server.inject('/sweet');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['always=sweet; Secure; HttpOnly; SameSite=Strict']);
    });

    it('fails to set cookie value automatically using function', async () => {

        const present = (request) => {

            throw new Error();
        };

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });
        server.state('always', { autoValue: present });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(500);
        expect(res.headers['set-cookie']).to.not.exist();
    });

    it('sets cookie value with null ttl', async () => {

        const server = Hapi.server();
        server.state('a', { ttl: null });
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').state('a', 'b') });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['a=b; Secure; HttpOnly; SameSite=Strict']);
    });

    it('sets cookie value based on request', async () => {

        const server = Hapi.server();

        const contextualize = (definition, request) => {

            definition.isSameSite = request.query.x;
            definition.isSecure = false;
        };

        server.state('a', { contextualize });
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').state('a', 'b') });

        const res = await server.inject('/?x=TEST');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['set-cookie']).to.equal(['a=b; HttpOnly; SameSite=TEST']);
    });
});
