/**
    To Test:
    
        Run the server.
        Try various URLs like:
            http://localhost:8080/ // success
            http://localhost:8080/?username=test // success
            http://localhost:8080/admin?username=walmart&password=worldofwalmartlabs // success
            http://localhost:8080/admin?username=walmart // fail
            http://localhost:8080/users?email=vnguyen@walmart.com // success
            http://localhost:8080/users?email=@walmart.com // fail
            http://localhost:8080/config?choices=1&choices=2 // success
            http://localhost:8080/config?choices=1 // success
            http://localhost:8080/config // fail
*/

// Load modules

var Hapi = require('../../lib/hapi');
var S = Hapi.Types.String,
    N = Hapi.Types.Number,
    A = Hapi.Types.Array;

// Declare internals

var internals = {};


internals.main = function () {

    var config = {};

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080, config);

    // Set routes

    http.addRoutes([
        { method: 'GET', path: '/', config: { handler: internals.get, validate: { query: { username: S() } } } },
        { method: 'GET', path: '/admin', config: { handler: internals.get, validate: { query: { username: S().required().with('password'), password: S() } } } },
        { method: 'GET', path: '/users', config: { handler: internals.get, validate: { query: { email: S().email().required().min(18) } } } },
        { method: 'GET', path: '/config', config: { handler: internals.get, validate: { query: { choices: A().required() } } } },
        { method: 'GET', path: '/test', config: { handler: internals.get, validate: { query: { num: N().min(0) } } } },
        { method: 'GET', path: '/test2', config: { handler: internals.get, validate: { query: { p1: S().required().rename('itemId') } } } },
        { method: 'GET', path: '/simple', config: { handler: internals.get, validate: { query: { input: S().min(3) } } } }
    ]);

    var schema = {
        title: S(),
        status: S().valid('open', 'pending', 'close'),
        participants: A().includes(S(), N())
    };

    http.addRoute({
        method: 'POST',
        path: '/users/{id}',
        config: {
            handler: internals.payload,
            validate: {
                query: {},
                schema: schema
            }
        }
    });

    // Start Hapi servers
    http.start();
};


internals.get = function (request) {

    request.reply('Success!\n');
};


internals.payload = function (request) {

    request.reply('Success!\n');
};


internals.main();
