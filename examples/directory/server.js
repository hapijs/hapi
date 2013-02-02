// Load modules

var Hapi = require('../../lib');


// Declare internals

var internals = {};


internals.serveImages = function (request) {

    return '../../images/';
};


internals.main = function () {

    var http = new Hapi.Server(8080);

    http.route([
        { method: 'GET', path: '/img/{path}', handler: { directory: { path: internals.serveImages } } },
        { method: 'GET', path: '/files/{path*}', handler: { directory: { path: '../../', listing: true } } },
        { method: 'GET', path: '/{path?}', handler: { directory: { path: './' } } }
    ]);

    http.start();
};


internals.main();

