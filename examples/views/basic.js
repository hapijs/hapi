// Load modules

var Hapi = require('../../lib');
var request = require('request');

var version =  "v" + require('../../package.json').version;

// Declare internals

var internals = {};


var basicHandler = function (request) {

    request.reply.render('index', {
        title: 'examples/views/index.js | Hapi ' + version, // auto pop version #
        message: 'Hello World!\n'
    });
};


internals.main = function () {

    var options = {
        views: {
            path: __dirname + "/views",
            engine: {
                name: "handlebars",
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

