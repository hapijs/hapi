// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'GET', path: '/', config: { proxy: { host: 'google.com', port: 80 } } });
    http.addRoute({ method: 'GET', path: '/images/srpr/logo3w.png', config: { proxy: { host: 'google.com', port: 80 } } });

    // Start Hapi servers
    http.start();
};


internals.main();