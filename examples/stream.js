// Load modules

var Hapi = require('../lib');
var Nipple = require('nipple');


// Declare internals

var internals = {};


internals.echo = function (request, reply) {

    reply(request.raw.req);
};


internals.request = function (request, reply) {

    Nipple.request('GET', 'http://google.com', {}, function (err, res) {

        reply(err || res);
    });
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'POST', path: '/', config: { handler: internals.echo, payload: { output: 'stream' } } });
    server.route({ method: 'GET', path: '/request', handler: internals.request });
    server.start();
};


internals.main();

