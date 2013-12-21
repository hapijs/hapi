// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.profile = function (request, reply) {

    reply({
        'id': 'fa0dbda9b1b',
        'name': 'John Doe'
    });
};


internals.main = function () {

    var config = {
        cache: {
            engine: 'redis',
            host: '127.0.0.1',
            port: 6379
        }
    };

    var server = new Hapi.Server(8000, config);

    server.route({ method: 'GET', path: '/profile', config: { handler: internals.profile, cache: { expiresIn: 30000 } } });

    server.helper('user', function (id, next) {

        setTimeout(function () {

            next({
                'id': id,
                'name': 'Item'
            });
        }, 600);    // Used to demonstrate stale response
    }, { cache: { expiresIn: 20000, staleIn: 10000, staleTimeout: 500 } });


    internals.item = function (request, reply) {

        server.helpers.user(request.params.id, reply);
    };

    server.route({ method: 'GET', path: '/item/{id}', config: { handler: internals.item } });

    server.start();
};


internals.main();

