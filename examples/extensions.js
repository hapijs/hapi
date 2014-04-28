// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function (request, reply) {

    reply('Success!\n');
};


internals.onRequest = function (request, reply) {

    console.log('onRequest');
    reply();
};


internals.onPreHandler1 = function (request, reply) {

    console.log('onPreHandler1: ' + request.method);
    reply();
};


internals.onPreHandler2 = function (request, reply) {

    console.log('onPreHandler2: ' + request.path);
    reply();
};


internals.onPostHandler = function (request, reply) {

    console.log('onPostHandler');
    reply();
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.ext('onRequest', internals.onRequest);                                         // New request, before handing over to the router (allows changes to method and url)
    server.ext('onPreHandler', [internals.onPreHandler1, internals.onPreHandler2]);       // After validation and body parsing, before route handler
    server.ext('onPostHandler', internals.onPostHandler);                                 // After route handler returns, before setting response

    server.route({ method: 'GET', path: '/', handler: internals.get });
    server.start();
};


internals.main();

