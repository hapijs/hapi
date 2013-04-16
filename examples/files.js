// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var http = new Hapi.Server(8080);

    var filePath = function (request) {

        return './' + request.params.file + '.js';
    };

    http.route([
        { method: 'GET', path: '/favicon.ico', handler: { file: './favicon.ico' } },
        { method: 'GET', path: '/download', handler: { file: { path: './favicon.ico', mode: 'attachment' } } },
        { method: 'GET', path: '/source/{file}', handler: { file: filePath } }
    ]);

    http.start();
};


internals.main();

