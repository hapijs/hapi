// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Generic = require('../../lib/response/generic.js');


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

        var Custom = function (blow) {
            
            Generic.call(this);
            this.variety = 'x-custom';
            this.blow = blow;
        };

        Hapi.utils.inherits(Custom, Generic);

        Custom.prototype._prepare = function (request, callback) {

            callback(Hapi.error.badRequest());
        };

        var handler = function (request, reply) {

            request.setState('bad', {});
            reply(new Custom());
        };

        var server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', config: { handler: handler } });

        server.inject('/', function (res) {

            expect(res.result.code).to.equal(400);
            done();
        });
    });

    it('returns an error on infinite _prepare loop', function (done) {

        var Custom = function (blow) {
        
            Generic.call(this);
            this.variety = 'x-custom';
            this.blow = blow;
        };

        Hapi.utils.inherits(Custom, Generic);

        Custom.prototype._prepare = function (request, callback) {

            callback(this);
        };

        var handler = function (request, reply) {

            reply(new Custom());
        };

        var server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', config: { handler: handler } });

        server.inject('/', function (res) {

            expect(res.result.code).to.equal(500);
            done();
        });
    });
});