// Load modules

var Hapi = require('../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'GET', path: '/', handler: internals.get });

    // Create request
    var req = {
        method: 'get',
        url: '/'
    };

    Hapi.Injection.inject(http, req, function (res) {

        console.log(res);
    });
};


internals.get = function (request) {

    request.reply('Success!\n');
};


internals.main();

