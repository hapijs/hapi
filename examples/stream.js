// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.echo = function () {

    this.reply(this.raw.req);
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'POST', path: '/', config: { handler: internals.echo, payload: 'stream' } });
    server.start();
};


internals.main();

