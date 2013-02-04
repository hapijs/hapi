// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var http = new Hapi.Server(8080);

    http.route({ method: 'GET', path: '/', handler: { proxy: { host: 'google.com', port: 80 } } });
    http.route({ method: 'GET', path: '/images/srpr/logo3w.png', handler: { proxy: { host: 'google.com', port: 80 } } });
    http.route({ method: 'POST', path: '/', handler: { proxy: { host: 'google.com', port: 80 } } });

    http.start();
};


internals.main();
