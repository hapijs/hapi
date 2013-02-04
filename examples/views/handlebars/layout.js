// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};


var handler = function (request) {

    request.reply.view('withLayout/index', {
        title: 'examples/views/handlebars/layout.js | Hapi ' + Hapi.utils.version(),
        message: 'Hello World!\n'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + '/templates',
            engine: {
                module: 'handlebars',
                extension: 'html'
            },
            layout: true
        }
    };

    var server = new Hapi.Server(3000, options);
    server.route({ method: 'GET', path: '/', handler: handler });
    server.start();
};


internals.main();

