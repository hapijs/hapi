// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    var config = {
        cache: {
            engine: 'redis',
            host: '127.0.0.1',
            port: 6379
        }
    };

    // Create Hapi servers

    var http = new Hapi.Server('0.0.0.0', 8080, config);

    // Set routes

    http.setRoutesDefaults({ authentication: 'none' });
    http.addRoutes([{ method: 'GET', path: '/profile', config: { handler: internals.profile, cache: { rule: { expiresInSec: 120 } } } },
        { method: 'GET', path: '/item', config: { handler: internals.activeItem } },
        { method: 'GET', path: '/item/:id', config: { handler: internals.item } }]);

    // Start Hapi servers

    http.start();
};


internals.profile = function (request) {
    request.reply({
        'id': 'fa0dbda9b1b',
        'name': 'John Doe'
    });
};

internals.activeItem = function (request) {
    request.reply({
        'id': '55cf687663',
        'name': 'Active Item'
    });
};

internals.item = function (request) {
    request.reply({
        'id': request.params.id,
        'name': 'Item'
    });
};

internals.main();