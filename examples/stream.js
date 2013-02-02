// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.echo = function (request) {

    request.reply.stream(request.raw.req)
                 .type(request.raw.req.headers['Content-Type'])
                 .bytes(request.raw.req.headers['Content-Length'])
                 .send();
};


internals.main = function () {

    var http = new Hapi.Server(8080);
    http.route({ method: 'POST', path: '/', config: { handler: internals.echo, payload: 'stream' } });
    http.start();
};


internals.main();

