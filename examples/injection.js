// Load modules

var Hapi = require('../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi server
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'GET', path: '/', handler: internals.get });

    // Create request
    var req = {
        method: 'get',
        url: '/'
    };

    http.inject(req, function (res) {

        console.log(res.result || res.readPayload());
    });
};


internals.get = function (request) {

    request.reply('Success!');
};


internals.main();

