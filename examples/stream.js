// Load modules

var Hapi = require('../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'POST', path: '/', config : { handler: internals.echo, payload: 'stream' } });

    // Start Hapi servers
    http.start();
};


internals.echo = function (request) {

    request.contentType = request.raw.req.headers['Content-Type'];
    request.contentLength = request.raw.req.headers['Content-Length'];
    request.reply(request.raw.req);
};


internals.main();

