'use strict';

const Code = require('code');
const Lab = require('lab');

const Promises = require('../lib/promises');


const internals = {};


const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('promise', () => {

    it('recognises a promise as thennable', (done) => {

        const promise = new Promise(() => {});
        expect(Promises.isThennable(promise)).to.equal(true);

        done();

    });

    it('recognises invalid input as not thennable', (done) => {

        expect(Promises.isThennable(undefined)).to.equal(false);
        expect(Promises.isThennable(null)).to.equal(false);
        expect(Promises.isThennable({ })).to.equal(false);
        expect(Promises.isThennable({ then: true })).to.equal(false);

        done();

    });
});
