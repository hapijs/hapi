// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    // Create Hapi servers
    var http = new Hapi.Server('0.0.0.0', 8080, { debug: true });

    // Set routes
    http.addRoute({
        method: 'GET',
        path: '/',
        config: {
            pre: [
                { method: internals.fetch1, assign: 'm1', mode: 'parallel' },
                { method: internals.fetch2, assign: 'm2' },
                { method: internals.fetch3, assign: 'm3', mode: 'parallel' },
                { method: internals.fetch4, assign: 'm4', mode: 'parallel' },
                { method: internals.fetch5, assign: 'm5' }
            ],
            handler: internals.get
        }
    });

    // Start Hapi servers
    http.start();
};


internals.fetch1 = function (request, next) {

    next('Hello');
};


internals.fetch2 = function (request, next) {

    next(request.pre.m1 + request.pre.m3 + request.pre.m4);
};


internals.fetch3 = function (request, next) {

    setTimeout(function () {

        next(' ');
    }, 1000);
};


internals.fetch4 = function (request, next) {

    next('World');
};


internals.fetch5 = function (request, next) {

    next(request.pre.m2 + '!');
};


internals.get = function (request) {

    request.reply(request.pre.m5 + '\n');
};


internals.main();

