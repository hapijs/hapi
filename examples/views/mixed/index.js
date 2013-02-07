// Load modules

var Hapi = require('../../../lib');


// Declare internals

var internals = {};

var ctx = {
    title: 'examples/views/mixed/basic.js | Hapi ' + Hapi.utils.version(),
    message: 'Hello World!'
}

var oneHandler = function (request) {

    request.reply.view('index', ctx).send();
};

var twoHandler = function (request) {

    request.reply.view('handlebars', ctx).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + '/templates',
            engines: {
                'html': { module: 'handlebars' },
                'jade': { module: 'jade' }
            }
        }
    };

    var server = new Hapi.Server(3000, options);
    server.route({ method: 'GET', path: '/one', handler: oneHandler });
    server.route({ method: 'GET', path: '/two', handler: twoHandler });
    server.start();
};


internals.main();
