// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');
var LogHelper = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Log', function () {

    describe('#event', function () {

        it('fires an event with the passed in tags', function (done) {

            var tags = ['hello'];
            Hapi.log.once('log', function (event) {

                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('hello');
                done();
            });
            Hapi.log.event(tags, null, Date.now());
        });

        it('outputs to stdout if no listeners exist', function (done) {

            Hapi._TEST.once('log', function (output) {

                expect(output).to.contain('hello');
                done();
            });

            Hapi.log.event(['hello'], null, Date.now());
        });
    });

    describe('#print', function () {

        it('outputs correct text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: 'test'
            };

            Hapi._TEST.once('log', function (output) {

                expect(output).to.contain('test');
                expect(output).to.contain('tag1');
                done();
            });

            Hapi.log.print(event, false);
        });

        it('outputs correct error text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: { a: 1 }
            };
            event.data.b = event.data;

            Hapi._TEST.once('log', function (output) {

                expect(output).to.contain('JSON Error');
                done();
            });

            Hapi.log.print(event, false);
        });
    });
});

