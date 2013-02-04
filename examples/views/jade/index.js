// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};


var rootHandler = function (request) {

    request.reply.view('index', {
        title: 'examples/views/jade/index.js | Hapi ' + Hapi.utils.version(),
        message: 'Index - Hello World!'
    }).send();
};

var aboutHandler = function (request) {

    request.reply.view('about', {
        title: 'examples/views/jade/index.js | Hapi ' + Hapi.utils.version(),
        message: 'About - Hello World!'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + '/templates',
            engine: {
                module: 'jade',
                extension: 'jade'
            },
            compileOptions: {
                pretty: true
            }
        }
    };

    var server = new Hapi.Server(3000, options);
    server.route({ method: 'GET', path: '/', handler: rootHandler });
    server.route({ method: 'GET', path: '/about', handler: aboutHandler });
    server.start();
};


internals.main();
