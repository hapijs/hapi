// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};


var rootHandler = function (request, reply) {

    reply.view('index', {
        title: 'examples/views/jade/index.js | Hapi ' + Hapi.utils.version(),
        message: 'Index - Hello World!'
    });
};

var aboutHandler = function (request, reply) {

    reply.view('about', {
        title: 'examples/views/jade/index.js | Hapi ' + Hapi.utils.version(),
        message: 'About - Hello World!'
    });
};


internals.main = function () {

    var options = {
        views: {
            engines: { jade: 'jade' },
            path: __dirname + '/templates',
            compileOptions: {
                pretty: true
            }
        }
    };

    var server = new Hapi.Server(8000, options);
    server.route({ method: 'GET', path: '/', handler: rootHandler });
    server.route({ method: 'GET', path: '/about', handler: aboutHandler });
    server.start();
};


internals.main();
