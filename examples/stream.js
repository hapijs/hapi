// Load modules

var Hapi = require('../lib');
var Wreck = require('wreck');


// Declare internals

var internals = {};


internals.echo = function (request, reply) {

    reply(request.payload);
};


internals.request = function (request, reply) {

    Wreck.request('GET', 'http://google.com', {}, reply);
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'POST', path: '/', config: { handler: internals.echo, payload: { output: 'stream' } } });
    server.route({ method: 'GET', path: '/request', handler: internals.request });
    server.start();
};


internals.main();

