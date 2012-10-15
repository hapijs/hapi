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

    var config = { name: 'Example', docs: true };

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080, config);

    // Set routes

    http.addRoutes([
        { method: 'GET', path: '/', config: { handler: internals.get, query: { username: S() } } },
        { method: 'GET', path: '/admin', config: { handler: internals.get, query: { username: S().required().with('password'), password: S() } } },
        { method: 'GET', path: '/users', config: { handler: internals.get, query: { email: S().email().required().min(18) } } },
        { method: 'GET', path: '/config', config: { handler: internals.get, query: { choices: A().required() } } },
        { method: 'GET', path: '/test', config: { handler: internals.get, query: { num: N().min(0) } } },
        { method: 'GET', path: '/test2', config: { handler: internals.get, query: { p1: S().required().rename('itemId') } } },
        { method: 'GET', path: '/simple', config: { handler: internals.get, query: { input: S().min(3) } } },
        { method: 'GET', path: '/users/{id}', config: { description: 'Get a user', handler: internals.get, query: { name: S().description('the user name').required() } } }
    ]);

    var schema = {
        title: S().invalid('director'),
        status: S().valid('open', 'pending', 'close'),
        participants: A().includes(S(), N())
    };

    http.addRoute({
        method: 'POST',
        path: '/users/{id}',
        config: {
            handler: internals.payload,
            query: {},
            schema: schema
        }
    });

    // Start Hapi servers
    http.start();
};


internals.get = function (request) {

    console.log(request.query);
    request.reply('Success!\n');
};

internals.payload = function (request) {

    console.log("payload", request.payload);
    request.reply('Success!\n');
}


internals.main();
