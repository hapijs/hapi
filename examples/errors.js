// Demonstrates how to hide error messages from the client

// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function (request) {

    request.reply(new Error('Here is my error'));
};


internals.onPostHandler = function (request, next) {

    if (request.response.isBoom) {
        request.response.response.payload.message = 'Censored Error';
    }

    next();
};


internals.main = function () {

    var http = new Hapi.Server(8080);

    http.ext('onPostHandler', internals.onPostHandler);

    http.route({ method: 'GET', path: '/', handler: internals.get });
    http.start();
};


internals.main();

