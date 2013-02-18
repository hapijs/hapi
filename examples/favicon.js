// Example serves a favicon.ico file that is cached on the client for a day

// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var http = new Hapi.Server(8080);

    http.route([
        { method: 'GET', path: '/favicon.ico', handler: { file: './favicon.ico' }, config: { cache: { mode: 'client', expiresIn: 86400000, privacy: 'public' } } }
    ]);

    http.start();
};


internals.main();

