// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.profile = function () {

    this.reply({
        'id': 'fa0dbda9b1b',
        'name': 'John Doe'
    });
};


internals.activeItem = function () {

    this.reply({
        'id': '55cf687663',
        'name': 'Active Item'
    });
};


internals.item = function () {

    setTimeout(function () {

        this.reply({
            'id': this.params.id,
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

    var server = new Hapi.Server(8000, config);

    server.route([
        { method: 'GET', path: '/profile', config: { handler: internals.profile, cache: { expiresIn: 30000 } } },
        { method: 'GET', path: '/item', config: { handler: internals.activeItem } },
        { method: 'GET', path: '/item/{id}', config: { handler: internals.item, cache: { mode: 'server', expiresIn: 20000, staleIn: 10000, staleTimeout: 500 } } }
    ]);

    server.start();
};


internals.main();

