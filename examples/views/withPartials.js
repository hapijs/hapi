// Load modules

var Hapi = require('../../lib');

// Declare internals

var internals = {};


var basicHandler = function (request) {

    request.reply.view('withPartials/index', {
        title: 'examples/views/withPartials.js | Hapi ' + Hapi.utils.version(),
        message: 'Hello World!\n'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + '/views',
            engine: {
                module: 'handlebars'
            },
            partials: {
                path: __dirname + '/views/withPartials'
            }
        }
    };

    var server = new Hapi.Server(3000, options);
    server.addRoute({ method: 'GET', path: '/', handler: basicHandler });
    server.start();
};


internals.main();

