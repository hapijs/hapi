// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var server = new Hapi.Server(8000, { files: { relativeTo: __dirname } });

    var filePath = function (request) {

        return './' + request.params.file + '.js';
    };

    server.route([
        { method: 'GET', path: '/favicon.ico', handler: { file: './favicon.ico' } },
        { method: 'GET', path: '/download', handler: { file: { path: './favicon.ico', mode: 'attachment' } } },
        { method: 'GET', path: '/source/{file}', handler: { file: filePath } }
    ]);

    server.start();
};


internals.main();

