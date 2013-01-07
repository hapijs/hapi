// Load modules

var Hapi = require('../../lib');
var Request = require('request');
var Multitool = require('multitool');

// Declare internals

var internals = {};


var layoutExampleHandler = function (request) {

    request.reply.view('withLayout/index', {
        title: 'examples/views/withLayout.js | Hapi ' + Hapi.utils.version(),
        message: 'Hello World!\n'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + '/views',
            engine: {
                module: 'handlebars',
                extension: 'html'
            },
            layout: true
        }
    };

    var server = new Hapi.Server(3000, options);
    server.addRoute({ method: 'GET', path: '/', handler: layoutExampleHandler });
    server.start();
};


internals.main();

