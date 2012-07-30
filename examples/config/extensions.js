// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Initialize process

    Hapi.Process.initialize();

    var config = {

        ext: {

            // All extension functions use the following signature:
            // function (req, res, next) { next(); }

            // In route extensions can be a single function or an array of functions

            onRequest: internals.onRequest,                 // New request, before handing over to the router (allows changes to req.method and req.url)
            onPreHandler: [internals.onPreHandler1,
                           internals.onPreHandler2],        // After validation and body parsing, before route handler
            onPostHandler: internals.onPostHandler,         // After route handler returns, before setting response
            onPostRoute: internals.onPostRoute,             // After response sent

            // Overrides hapi's default handler for unknown route. Cannot be an array!

            onUnknownRoute: internals.onUnknownRoute
        }
    };

    // Create Hapi servers

    var http = new Hapi.Server.Server('0.0.0.0', 8080, config);

    // Set routes

    http.setRoutesDefaults({ authentication: 'none' });
    http.addRoutes([{ method: 'GET', path: '/', handler: internals.get }]);

    // Start Hapi servers

    http.start();

    // Finalize Hapi environment

    Hapi.Process.finalize();

    Hapi.Log.info('Hapi server started');
};


internals.get = function (req, reply) {

    reply('Success!\n');
};


internals.onRequest = function (req, res, next) {

    Hapi.Log.info('onRequest');
    next();
};


internals.onPreHandler1 = function (req, res, next) {

    Hapi.Log.info('onPreHandler1: ' + req.method);
    next();
};


internals.onPreHandler2 = function (req, res, next) {

    Hapi.Log.info('onPreHandler2: ' + req.url);
    next();
};


internals.onPostHandler = function (req, res, next) {

    Hapi.Log.info('onPostHandler');
    next();
};


internals.onPostRoute = function (req, res, next) {

    Hapi.Log.info('onPostRoute');
    next();
};


internals.onUnknownRoute = function (req, res, next) {

    Hapi.Log.info('onUnknownRoute');
    res.writeHead(404);
    res.end();
    next();
};


internals.main();

