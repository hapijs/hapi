// Load modules

var Hapi = require('../../lib');


// Declare internals

var internals = {};


internals.images = function (request) {

    return '../../images/';
};


internals.main = function () {

    var server = new Hapi.Server(8000, { files: { relativeTo: __dirname } });

    server.route([
        { method: 'GET', path: '/img/{path}', handler: { directory: { path: internals.images } } },
        { method: 'GET', path: '/files/browse/{path*}', handler: { directory: { path: '../../', listing: true } } },
        { method: 'GET', path: '/{path?}', handler: { directory: { path: './' } } }
    ]);

    server.start();
};


internals.main();

