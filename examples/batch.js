// Load modules

var Hapi = require('../lib/hapi');


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

    request.reply({
        'id': request.params.id,
        'name': 'Item'
    });
};


internals.main = function () {

    var http = new Hapi.Server(8080, { batch: true });

    http.addRoutes([{ method: 'GET', path: '/profile', config: { handler: internals.profile } },
                    { method: 'GET', path: '/item', config: { handler: internals.activeItem } },
                    { method: 'GET', path: '/item/{id}', config: { handler: internals.item } }]);

    http.start();
};


internals.main();

