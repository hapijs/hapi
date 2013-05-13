// Load modules

var Lab = require('lab');
var Boom = require('boom');
var Events = require('events');
var Client = require('../../lib/client');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Client', function () {

    describe('#parse', function () {

        it('handles errors with a boom response', function (done) {

            var res = new Events.EventEmitter();
            res.pipe = function () { };

            Client.parse(res, function (err) {

                expect(err).to.be.instanceOf(Boom);
                done();
            });

            res.emit('error', new Error('my error'));
        });

        it('handles responses that close early', function (done) {

            var res = new Events.EventEmitter();
            res.pipe = function () { };

            Client.parse(res, function (err) {

                expect(err).to.be.instanceOf(Boom);
                done();
            });

            res.emit('close');
        });
    });
});



