// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes

    http.addRoutes([
        { method: 'GET', path: '/img/{path}', handler: { directory: { path: internals.serveImages } } },
        { method: 'GET', path: '/files/{path*}', handler: { directory: { path: '../', listing: true } } },
        { method: 'GET', path: '/{path?}', handler: { directory: { path: './' } } }
    ]);

    // Start Hapi servers
    http.start();
};


internals.serveImages = function(request) {

    return '../../images/hapi.png';
};


internals.main();