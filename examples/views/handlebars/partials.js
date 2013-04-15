// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};


var handler = function (request) {

    request.reply.view('withPartials/index', {
        title: 'examples/views/handlebars/partials.js | Hapi ' + Hapi.utils.version(),
        message: 'Hello World!\n'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            engines: { html: 'handlebars' },
            path: __dirname + '/templates',
            partialsPath: __dirname + '/templates/withPartials'
        }
    };

    var server = new Hapi.Server(3000, options);
    server.route({ method: 'GET', path: '/', handler: handler });
    server.start();
};


internals.main();

