// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


// Type shortcuts

var S = Hapi.types.string;
var N = Hapi.types.number;
var A = Hapi.types.array;


internals.get = function (request, reply) {

    reply('Success!\n');
};


internals.payload = function (request, reply) {

    reply('Success!\n');
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.route([
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

    server.route({ method: 'POST', path: '/users/{id}', config: { handler: internals.payload, validate: { query: {}, payload: schema } } });

    server.start();
};


internals.main();

/*
    Try various URLs like:
    http://localhost:8000/ // success
    http://localhost:8000/?username=test // success
    http://localhost:8000/admin?username=steve&password=shhhhhh // success
    http://localhost:8000/admin?username=steve // fail
    http://localhost:8000/users?email=steve@example.com // success
    http://localhost:8000/users?email=@example.com // fail
    http://localhost:8000/config?choices=1&choices=2 // success
    http://localhost:8000/config?choices=1 // success
    http://localhost:8000/config // fail
*/
