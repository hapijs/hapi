// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};


var handler = function (request, reply) {

    reply.view('withLayout/index', {
        title: 'examples/views/handlebars/layout.js | Hapi ' + Hapi.version,
        message: 'Hello World!\n'
    });
};


internals.main = function () {

    var options = {
        views: {
            engines: { html: 'handlebars' },
            path: __dirname + '/templates',
            layout: true
        }
    };

    var server = new Hapi.Server(8000, options);
    server.route({ method: 'GET', path: '/', handler: handler });
    server.start();
};


internals.main();

