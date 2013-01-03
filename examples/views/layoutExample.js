// Load modules

var Hapi = require('../../lib');
var Request = require('request');
var Multitool = require('multitool');

// Declare internals

var internals = {};


var layoutExampleHandler = function (request) {

    request.reply.view('layoutExample/index', {
        title: 'examples/views/layoutExample.js | Hapi ' + Hapi.utils.version(),
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
            layout: true
        }
    };

    var server = new Hapi.Server(3000, options);
    server.addRoute({ method: 'GET', path: '/', handler: layoutExampleHandler });
    server.start(function(){
        Multitool.Notify({
            app: "Hapi",
            title: 'examples/views/layoutExample.js',
            message: "Server started on port 3000"
        });
    });
};


internals.main();

