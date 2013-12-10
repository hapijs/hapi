// Load modules

var Hapi = require('../lib');
var Request = require('request');


// Declare internals

var internals = {};


internals.echo = function (request, reply) {

    reply(this.raw.req);
};


internals.request = function (request, reply) {

    var reqStream = Request('http://google.com');
    reqStream.once('response', reply);
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'POST', path: '/', config: { handler: internals.echo, payload: 'stream' } });
    server.route({ method: 'GET', path: '/request', handler: internals.request });
    server.start();
};


internals.main();

