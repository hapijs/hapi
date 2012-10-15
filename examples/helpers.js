// Load modules

var Hapi = require('../lib/hapi');


// Declare internals

var internals = {
    gen: 0
};


internals.main = function () {

    // Create Hapi server
    var server = new Hapi.Server('0.0.0.0', 8080, { cache: true });

    server.addHelper('user', internals.user, { cache: { expiresIn: 2000, staleIn: 1000, staleTimeout: 100 } });

    server.helpers.user(4, function (result1) {

        console.log(result1);

        setTimeout(function () {

            server.helpers.user(4, function (result2) {

                console.log(result2);

                setTimeout(function () {

                    server.helpers.user(4, function (result3) {

                        console.log(result3);
                    });
                }, 50);
            });
        }, 1010);
    });
};


internals.user = function (id, next) {

    setTimeout(function () {

        return next({ id: id, gen: ++internals.gen });
    }, 110);
};


internals.main();

