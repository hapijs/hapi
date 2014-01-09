// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var server = new Hapi.Server(8000, { files: { relativeTo: __dirname } });

    // Serves a favicon.ico file that is cached on the client for a day

    server.route({ method: 'GET', path: '/favicon.ico', handler: { file: 'favicon.ico' }, config: { cache: { expiresIn: 86400000 } } });
    server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('hello world!'); } });
    server.start();
};


internals.main();

