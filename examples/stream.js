// Load modules

var Hapi = require('../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server(8080);

    // Set routes
    http.addRoute({ method: 'POST', path: '/', config : { handler: internals.echo, payload: 'stream' } });

    // Start Hapi servers
    http.start();
};


internals.echo = function (request) {

    request.reply.type(request.raw.req.headers['Content-Type'])
                 .bytes(request.raw.req.headers['Content-Length'])
                 .stream(request.raw.req);
};


internals.main();

