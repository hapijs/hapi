// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


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

    setTimeout(function () {

        request.reply({
            'id': request.params.id,
            'name': 'Item'
        });
    }, 600);
};


internals.main = function () {

    var config = {
        cache: {
            engine: 'redis',
            host: '127.0.0.1',
            port: 6379
        }
    };

    var http = new Hapi.Server(8080, config);

    http.route([
        { method: 'GET', path: '/profile', config: { handler: internals.profile, cache: { expiresIn: 30000 } } },
        { method: 'GET', path: '/item', config: { handler: internals.activeItem } },
        { method: 'GET', path: '/item/{id}', config: { handler: internals.item, cache: { expiresIn: 20000, staleIn: 10000, staleTimeout: 500 } } }
    ]);

    http.start();
};


internals.main();

