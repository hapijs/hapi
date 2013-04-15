// Load modules

var Lab = require('lab');
var Hapi = require('../../..');
var Views = require('../../../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Response', function () {

    describe('View', function () {

        it('returns error on invalid template path', function (done) {

            var manager = new Views({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/../templates/invalid'
            });

            var view = new Hapi.response.View(manager, 'test', { message: 'Ohai' });
            view._prepare({}, function (response) {

                expect(response instanceof Error).to.equal(true);
                done();
            });
        });
    });
});

