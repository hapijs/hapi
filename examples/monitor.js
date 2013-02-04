// Load modules

var Hapi = require('../lib');
var request = require('request');


// Declare internals

var internals = {};


var testHandler = function (request) {

    request.reply('Hello World!\n');
};


var requestsHandler = function (request) {

    console.log('Request: ' + JSON.stringify(request.payload, null, 4));
    request.reply();
};


var opsHandler = function (request) {

    console.log('Ops: ' + JSON.stringify(request.payload, null, 4));
    request.reply();
};


internals.main = function () {

    // Server

    var options = {
        monitor: {
            subscribers: {
                console: [],
                'http://localhost:8081/requests': ['request'],
                'http://localhost:8081/ops': ['ops']
            }
        }
    };

    var server = new Hapi.Server(8080, options);
    server.route({ method: 'GET', path: '/', handler: testHandler });
    server.start();

    // Monitor

    var monitor = new Hapi.Server(8081);
    monitor.route({ method: 'POST', path: '/requests', handler: requestsHandler });
    monitor.route({ method: 'POST', path: '/ops', handler: opsHandler });
    monitor.start();
};


internals.main();

