// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Debug', function () {

    var _server = null;

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

    function setupServer() {

        _server = new Hapi.Server('0.0.0.0', 0, { debug: { websocketPort: 3003 } });
        _server.route([
            { method: 'GET', path: '/profile', config: { handler: profileHandler } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler } },
            { method: 'GET', path: '/item/{id}', config: { handler: itemHandler } }
        ]);
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