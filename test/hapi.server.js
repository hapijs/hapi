var should = require("should");
var Hapi = require("../index");

var testHandler = function(hapi, reply) {

    reply("ohai")
}

describe("Hapi", function() {

    describe(".Server", function() {

        describe("#Server", function() {

            it("should initialize, start, and stop", function(done) {
                var host = "localhost",
                    port = 3000,
                    options = {
                      
                    },
                    routes = [
                        { method: 'GET',  path: '/', handler: testHandler, tos: 'none', authentication: 'none' }
                    ];

                Hapi.Process.initialize({

                    name: 'Test API Server'
                });
                
                var s = new Hapi.Server.Server(host, port, options, routes);
                s.start();

                setTimeout((function() {

                    s.stop();
                    done();
                }), 150);
            })
        })
    })
})