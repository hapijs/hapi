var Flod = require('flod');
var Hapi = require('../');

var server = new Hapi.Server(+process.env.port || 3000);
var probe = new Flod.Probe(server, { server: 'hapi', version: '1.x.x' });

var hello = {
    method: 'GET',
    path: '/',
    config: {
        validate: {
            query: true
        },
        handler: function (request) {

            request.reply('Hello World.');
        }
    }
};

server.route(hello);

server.start(function () {

    console.log('Server started on port ' + server.info.port);
});