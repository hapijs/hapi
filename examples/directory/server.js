// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes

    http.addRoutes([
        { method: 'GET', path: '/img/hapi', handler: { directory: internals.serveImages } },
        { method: 'GET', path: '/{path?}', handler: { directory: './' } }
    ]);

    // Start Hapi servers
    http.start();
};


internals.serveImages = function(request) {

    return '../../images/hapi.png';
};


internals.main();