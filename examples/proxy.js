// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var server = new Hapi.Server(8000);

    var mapper = function (request, callback) {

        callback(null, 'http://www.google.com/search?q=' + request.params.term);
    };

    server.route({ method: '*', path: '/{p*}', handler: { proxy: { host: 'google.com', port: 80, redirects: 5 } } });
    server.route({ method: 'GET', path: '/hapi/{term}', handler: { proxy: { mapUri: mapper } } });
    server.start();
};


internals.main();
