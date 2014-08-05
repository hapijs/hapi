// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var config = {
        cache: require('catbox-memory')
    };

    var server = new Hapi.Server(8000, config);

    server.method('user', function (id, next) {

        setTimeout(function () {

            next(null, {
                'id': id,
                'name': 'Item'
            });
        }, 600);    // Used to demonstrate stale response
    }, { cache: { expiresIn: 20000, staleIn: 10000, staleTimeout: 500 } });


    internals.item = function (request, reply) {

        server.methods.user(request.params.id, reply);
    };

    server.route({ method: 'GET', path: '/item/{id}', config: { handler: internals.item } });

    server.start();
};


internals.main();

