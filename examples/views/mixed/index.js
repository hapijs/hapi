// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};

var ctx = {
    title: 'examples/views/mixed/basic.js | Hapi ' + Hapi.utils.version(),
    message: 'Hello World!'
}

var oneHandler = function (request) {

    request.reply.view('index', ctx);
};

var twoHandler = function (request) {

    request.reply.view('handlebars', ctx);
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
