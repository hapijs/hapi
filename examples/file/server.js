// Load modules

var Hapi = require('../../lib');


// Declare internals

var internals = {};


internals.serveLogo = function (request, reply) {

    reply.file('../../images/hapi.png');
};


internals.main = function () {

    var http = new Hapi.Server(8000, { files: { relativeTo: __dirname } });

    http.route([
        { method: 'GET', path: '/', handler: { file: './index.html' } },
        { method: 'GET', path: '/img/logo.jpg', handler: internals.serveLogo }
    ]);

    http.start();
};


internals.main();

