// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function (request) {

    request.reply('Success!\n');
};


internals.onRequest = function (request, next) {

    Hapi.Log.event('onRequest');
    next();
};


internals.onPreHandler1 = function (request, next) {

    Hapi.Log.event('onPreHandler1: ' + request.method);
    next();
};


internals.onPreHandler2 = function (request, next) {

    Hapi.Log.event('onPreHandler2: ' + request.path);
    next();
};


internals.onPostHandler = function (request, next) {

    Hapi.Log.event('onPostHandler');
    next();
};


internals.onPostRoute = function (request, next) {

    Hapi.Log.event('onPostRoute');
    next();
};


internals.main = function () {

    var config = {
        ext: {
            onRequest: internals.onRequest,                 // New request, before handing over to the router (allows changes to method and url)
            onPreHandler: [internals.onPreHandler1,
                           internals.onPreHandler2],        // After validation and body parsing, before route handler
            onPostHandler: internals.onPostHandler,         // After route handler returns, before setting response
            onPostRoute: internals.onPostRoute,             // After response sent
        }
    };

    var http = new Hapi.Server(8080, config);
    http.addRoute({ method: 'GET', path: '/', handler: internals.get });
    http.start();
};


internals.main();

