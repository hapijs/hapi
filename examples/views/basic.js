// Load modules

var Hapi = require('../../lib');
var Request = require('request');

// Declare internals

var internals = {};


var basicHandler = function (request) {

    request.reply.view('basic/index', {
        title: 'examples/views/basic.js | Hapi ' + Hapi.utils.version(),
        message: 'Hello World!\n'
    }).send();
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + "/views",
            engine: {
                module: "handlebars",
                extension: "html"
            },
            partials: {
                path: __dirname + "/views/partials"
            }
        }
    };

    var server = new Hapi.Server(3000, options);
    server.addRoute({ method: 'GET', path: '/', handler: basicHandler });
    server.start();
};


internals.main();

