'use strict';

// Load modules

const Code = require('code');
const Hapi = require('..');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Server', () => {

    it('supports new Server()', async () => {

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: () => 'old school' });

        const res = await server.inject('/');
        expect(res.result).to.equal('old school');
    });
});
