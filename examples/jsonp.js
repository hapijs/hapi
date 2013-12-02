// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var server = new Hapi.Server(8000);

    var handler = function (request, reply) {

        console.log(request.raw.req.headers);
        var parts = request.params.name.split('/');
        reply({ first: parts[0], last: parts[1] });
    };

    server.route({ method: 'GET', path: '/user/{name*2}', config: { handler: handler, jsonp: 'callback' } });
    server.start(function () {

        console.log('Try: http://localhost:8000/user/1/2?callback=docall');
    });
};


internals.main();
