// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.get = function (request, reply) {

    var tail1 = request.tail('tail1');
    setTimeout(function () {

        console.log(1);
        tail1();
    }, 5000);

    var tail2 = request.tail('tail2');
    setTimeout(function () {

        console.log(2);
        tail2();
    }, 2000);

    reply('Success!\n');
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.route({ method: 'GET', path: '/', handler: internals.get });
    server.start();

    // Listen to tail events

    server.on('tail', function (request) {

        console.log('Wag the dog');
    });
};


internals.main();

