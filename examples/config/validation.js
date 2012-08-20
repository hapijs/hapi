// Load modules

var Hapi = require('../../lib/hapi');
var Types = Hapi.Types;
var S = Types.String,
    N = Types.Number,
    A = Types.Array;


// Declare internals

var internals = {};


internals.main = function () {

    // Initialize process

    Hapi.Process.initialize();

    var config = {};

    // Create Hapi servers

    var http = new Hapi.Server.Server('0.0.0.0', 8080, config);

    // Set routes

    http.setRoutesDefaults({ authentication: 'none' });
    http.addRoutes([{ method: 'GET', path: '/', handler: internals.get, query: {username: S()} }]);
    http.addRoutes([{ method: 'GET', path: '/admin', handler: internals.get, query: {username: S().required().with('password'), password: S()} }]);
    http.addRoutes([{ method: 'GET', path: '/users', handler: internals.get, query: {email: S().email().required().min(18)} }]);
    http.addRoutes([{ method: 'GET', path: '/config', handler: internals.get, query: {choices: A().required()} }]);

    // Start Hapi servers

    http.start();

    // Finalize Hapi environment

    Hapi.Process.finalize();

    Hapi.Log.info('Hapi server started');
};


internals.get = function (request) {

    request.reply('Success!\n');
};

internals.main();

