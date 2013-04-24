// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


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


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.route({
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

    server.start();
};


internals.main();

