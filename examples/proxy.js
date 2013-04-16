// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var http = new Hapi.Server(8080);

    http.route({ method: 'GET', path: '/', handler: { proxy: { host: 'google.com', port: 80 } } });
    http.route({ method: 'GET', path: '/images/srpr/logo3w.png', handler: { proxy: { host: 'google.com', port: 80 } } });
    http.route({ method: 'POST', path: '/', handler: { proxy: { host: 'google.com', port: 80 } } });

    var mapper = function (request, callback) {

        callback(null, 'https://www.google.com/?q=' + request.param.term);
    };

    http.route({ method: 'GET', path: '/search/{term}', handler: { proxy: { mapUri: mapper } } });


    http.start();
};


internals.main();
