// Load modules

var expect = require('chai').expect;
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');

describe('Batch', function() {
    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18084';

    var profileHandler = function (request) {
        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    };

    var activeItemHandler = function (request) {
        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    };

    var itemHandler = function (request) {
        request.reply({
            'id': request.params.id,
            'name': 'Item'
        });
    };

    function setupServer(done) {
        _server = new Hapi.Server('0.0.0.0', 18084, { batch: true });
        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { handler: profileHandler } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler } },
            { method: 'GET', path: '/item/:id', config: { handler: itemHandler } }
        ]);
        _server.listener.on('listening', function() {
            done();
        });
        _server.start();
    }

    function teardownServer(done) {
        _server.stop();
        done();
    }

    function makeRequest(payload, callback) {
        var next = function(res) {
            return callback(res.result);
        };

        _server.inject({
            method: 'post',
            url: _serverUrl + '/batch',
            payload: payload
        }, next);
    }

    before(setupServer);
    after(teardownServer);

    it('shows single response when making request for single endpoint', function(done) {
        makeRequest('{"get": ["/profile"]}', function(res) {
            expect(res[0].id).to.equal("fa0dbda9b1b");
            expect(res[0].name).to.equal("John Doe");
            expect(res.length).to.equal(1);
            done();
        });
    });

    it('shows two ordered responses when requesting two endpoints', function(done) {
        makeRequest('{"get": ["/profile", "/item"]}', function(res) {
            expect(res[0].id).to.equal("fa0dbda9b1b");
            expect(res[0].name).to.equal("John Doe");
            expect(res.length).to.equal(2);
            expect(res[1].id).to.equal("55cf687663");
            expect(res[1].name).to.equal("Active Item");
            done();
        });
    });

    it('supports piping a response into the next request', function(done) {
        makeRequest('{"get": ["/item", "/item/$0.id"]}', function(res) {
            expect(res.length).to.equal(2);
            expect(res[0].id).to.equal("55cf687663");
            expect(res[0].name).to.equal("Active Item");
            expect(res[1].id).to.equal("55cf687663");
            expect(res[1].name).to.equal("Item");
            done();
        });
    });
});