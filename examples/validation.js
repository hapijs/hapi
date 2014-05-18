// Load modules

var Hapi = require('../lib');
var Joi = require('joi');


// Declare internals

var internals = {};


internals.get = function (request, reply) {

    reply('Success!\n');
};


internals.payload = function (request, reply) {

    reply('Success!\n');
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.route([
        { method: 'GET', path: '/', config: { handler: internals.get, validate: { query: { username: Joi.string() } } } },
        { method: 'GET', path: '/admin', config: { handler: internals.get, validate: { query: Joi.object({ username: Joi.string().required(), password: Joi.string() }).and('username', 'password') } } },
        { method: 'GET', path: '/users', config: { handler: internals.get, validate: { query: { email: Joi.string().email().required().min(18) } } } },
        { method: 'GET', path: '/config', config: { handler: internals.get, validate: { query: { choices: Joi.array().required() } } } },
        { method: 'GET', path: '/test', config: { handler: internals.get, validate: { query: { num: Joi.number().min(0) } } } },
        { method: 'GET', path: '/test2', config: { handler: internals.get, validate: { query: Joi.object({ p1: Joi.string().required() }).rename('p1', 'itemId') } } },
        { method: 'GET', path: '/simple', config: { handler: internals.get, validate: { query: { input: Joi.string().min(3) } } } }
    ]);

    var schema = {
        title: Joi.string(),
        status: Joi.string().valid('open', 'pending', 'close'),
        participants: Joi.array().includes(Joi.string(), Joi.number())
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
