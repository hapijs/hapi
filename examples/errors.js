// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function () {

    this.reply(new Error('Here is my error'));
};


internals.onPreResponse = function (request, next) {

    // Demonstrates how to hide error messages from the client

    if (request.response().isBoom) {
        var error = request.response();
        error.response.payload.message = 'Censored Error';
    }

    next();
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.ext('onPreResponse', internals.onPreResponse);

    server.route({ method: 'GET', path: '/', handler: internals.get });
    server.start();
};


internals.main();

