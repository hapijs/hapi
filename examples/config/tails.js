// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080);

    // Set routes
    http.addRoute({ method: 'GET', path: '/', handler: internals.get });

    // Start Hapi servers
    http.start();

    // Listen to tail events
    http.on('tail', function (request) {

        console.log('Wag the dog');
    });
};


internals.get = function (request) {

    var tail1 = request.addTail('tail1');
    setTimeout(function () {

        console.log(1);
        request.removeTail(tail1);              // Using removeTail() interface
    }, 5000);

    var tail2 = request.addTail('tail2');
    setTimeout(function () {

        console.log(2);
        tail2();                                // Using tail() function interface
    }, 2000);

    request.reply('Success!\n');
};


internals.main();

