// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes

    http.addRoutes([
        { method: 'GET', path: '/', handler: { file: './index.html' } },
        { method: 'GET', path: '/img/logo.jpg', handler: internals.serveLogo }
    ]);

    // Start Hapi servers
    http.start();
};


internals.serveLogo = function(request) {

    request.reply(new Hapi.response.File('../../images/hapi.png'));
};


internals.main();