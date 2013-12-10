// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function (request, reply) {

    reply('Success!');
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'GET', path: '/', handler: internals.get });

    // Create request

    var req = {
        method: 'get',
        url: '/'
    };

    server.inject(req, function (res) {

        console.log(res.result);
    });
};


internals.main();

