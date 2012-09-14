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
var Types = Hapi.Types;
var S = Types.String,
    N = Types.Number,
    A = Types.Array;

// Debug modules
var sys = require("sys");



// Declare internals

var internals = {};


internals.main = function () {

    // Initialize process

    // Hapi.Process.initialize();

    var config = {};

    // Create Hapi servers

    var http = new Hapi.Server('0.0.0.0', 8080, config);

    // Set routes

    http.setRoutesDefaults({ authentication: 'none' });
    http.addRoutes([{ method: 'GET', path: '/', config: { handler: internals.get, query: {username: S()} } }]);
    http.addRoutes([{ method: 'GET', path: '/admin', config: { handler: internals.get, query: {username: S().required().with('password'), password: S()} } }]);
    http.addRoutes([{ method: 'GET', path: '/users', config: { handler: internals.get, query: {email: S().email().required().min(18)} } }]);
    http.addRoutes([{ method: 'GET', path: '/config', config: { handler: internals.get, query: { choices: A().required() } } }]);
    http.addRoutes([{ method: 'GET', path: '/test', config: { handler: internals.get, query: {num: N().min(0)} } }]);
    http.addRoutes([{ method: 'GET', path: '/test2', config: { handler: internals.get, query: {p1: S().required().rename('itemId')}}}]);
    http.addRoutes([{ method: 'GET', path: '/simple', config: { handler: internals.get, query: {input: S().min(3)} } }]);
    
    // Payload validation example
    // var s = {
    //     input: 
    //         A().includes(
    //             A().includes(
    //                 N().min(0)
    //             )
    //         )
    // }
    var s = {
        title: S(),
        status: S().valid('open', 'pending', 'close'),
        participants: A().includes(S(), N())
    }
    // console.log("schema", sys.inspect(s));
    // console.log(s.input._validators[1].toString())
    // console.log(sys.inspect(s.input._validators.map(function(d){ return d.toString();})));
    
    http.addRoutes([{ method: 'POST', path: '/users/:id', config: {
        handler: internals.payload,
        query: {},
        // schema: {
        //     username: S().required().min(3),
        //     emails: A().includes(S().email())
        // }
        schema: s
    }}]);

    // Start Hapi servers

    http.start();

    // Finalize Hapi environment

    // Hapi.Process.finalize();

    // Hapi.Log.info('Hapi server started');
};


internals.get = function (request) {

    console.log(request.query)
    request.reply('Success!\n');
};

internals.payload = function(request) {

    console.log("payload", request.payload)
    request.reply('Success!\n');
}



internals.main();
