// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Debug', function () {

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18086';

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

        _server = new Hapi.Server('0.0.0.0', 18086, { debug: { websocketPort: 3003 } });
        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { handler: profileHandler } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler } },
            { method: 'GET', path: '/item/{id}', config: { handler: itemHandler } }
        ]);
        _server.listener.on('listening', function () {

            done();
        });
        _server.start();
    }

    before(setupServer);

    it('shows the debug console when requesting the debug endpoint', function (done) {

        var request = {
            method: 'GET',
            url: '/debug/console'
        };

        _server.inject(request, function (res) {

            expect(res).to.exist;
            expect(res.result).to.contain('<title>Debug Console</title>');
            done();
        });
    });

    it('strip the debug parameter from the query', function (done) {

        var request = {
            method: 'GET',
            url: '/item?debug=123&other=a'
        };

        _server.inject(request, function (res) {

            expect(res).to.exist;
            expect(res.raw.req.url).to.equal('/item?other=a');
            done();
        });
    });
});