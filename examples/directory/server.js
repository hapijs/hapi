// Load modules

var Hapi = require('../../lib');


// Declare internals

var internals = {};


internals.serveImages = function (request) {

    return '../../images/';
};


internals.main = function () {

    var server = new Hapi.Server(8000, { files: { relativeTo: 'routes' } });

    server.route([
        { method: 'GET', path: '/img/{path}', handler: { directory: { path: internals.serveImages } } },
        { method: 'GET', path: '/files/{path*}', handler: { directory: { path: '../../', listing: true, redirectToSlash: true } } },
        { method: 'GET', path: '/{path?}', handler: { directory: { path: './' } } }
    ]);

    server.start();
};


internals.main();

