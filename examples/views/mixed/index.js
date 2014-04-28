// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};

var ctx = {
    title: 'examples/views/mixed | Hapi ' + Hapi.version,
    message: 'Hello World!'
}

var oneHandler = function (request, reply) {

    reply.view('index.jade', ctx);
};

var twoHandler = function (request, reply) {

    reply.view('handlebars.html', ctx);
};


internals.main = function () {

    var options = {
        views: {
            engines: {
                'html': 'handlebars',
                'jade': 'jade'
            },
            path: __dirname + '/templates',
        }
    };

    var server = new Hapi.Server(8000, options);
    server.route({ method: 'GET', path: '/one', handler: oneHandler });
    server.route({ method: 'GET', path: '/two', handler: twoHandler });
    server.start();
};


internals.main();
