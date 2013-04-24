// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {
    gen: 0
};


internals.user = function (id, next) {

    setTimeout(function () {

        return next({ id: id, gen: ++internals.gen });
    }, 110);
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.helper('user', internals.user, { cache: { expiresIn: 2000, staleIn: 1000, staleTimeout: 100 } });
    server.start(function () {

        server.helpers.user('john', function (result1) {

            console.log(result1);                                           // Gen: 1

            setTimeout(function () {

                server.helpers.user('john', function (result2) {

                    console.log(result2);                                   // Gen: 1

                    setTimeout(function () {

                        server.helpers.user('john', function (result3) {

                            console.log(result3);                           // Gen: 1

                            setTimeout(function () {

                                server.helpers.user('john', function (result4) {

                                    console.log(result4);                   // Gen: 2
                                    server.stop();
                                });
                            }, 50);
                        });
                    }, 1010);
                });
            }, 50);
        });
    });
};


internals.main();

