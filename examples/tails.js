// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


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


internals.main = function () {

    var http = new Hapi.Server(8080);
    http.route({ method: 'GET', path: '/', handler: internals.get });
    http.start();

    // Listen to tail events

    http.on('tail', function (request) {

        console.log('Wag the dog');
    });
};


internals.main();

