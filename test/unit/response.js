// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Response = require('../../lib/response');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Response', function () {

    it('returns last known error on error response loop', function (done) {

        var Custom = function (request) {

            Response.Plain.call(this, request, 'blow');
        };

        Hapi.utils.inherits(Custom, Response.Plain);

        Custom.prototype._marshall = function (request, callback) {

            callback(Hapi.error.badRequest());
        };

        var handler = function (request, reply) {

            reply.state('bad', {});
            reply(new Custom(request));
        };

        var server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', config: { handler: handler } });

        server.inject('/', function (res) {

            expect(res.result.statusCode).to.equal(400);
            done();
        });
    });
});