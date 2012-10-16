// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'GET', path: '/', config: { proxy: { host: 'google.com', port: 80 } } });
<<<<<<< HEAD
=======
    http.addRoute({ method: 'GET', path: '/images/srpr/logo3w.png', config: { proxy: { host: 'google.com', port: 80 } } });
    http.addRoute({ method: 'POST', path: '/', config: { proxy: { host: 'google.com', port: 80 } } });
>>>>>>> bab91db74dcf209e64c123d1131579dd70d5ad69

    // Start Hapi servers
    http.start();
};


<<<<<<< HEAD
internals.main();

=======
internals.main();
>>>>>>> bab91db74dcf209e64c123d1131579dd70d5ad69
