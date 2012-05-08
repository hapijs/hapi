var request = require('request');
var should = require("should");
var Hapi = require("../index");

var testHandler = function(hapi, reply) {

    reply("ohai");
}

describe("Hapi", function() {

    describe(".Server", function() {

        describe("#Server", function() {

            it("should initialize, start, and stop", function(done) {
                var host = "localhost",
                    port = 3000,
                    options = {
                      monitor: {
                        log: {
                          "http://localhost:9000/analytics/log": 1
                        },
                        interval: 15000
                      }
                    },
                    routes = [
                        { method: 'GET',  path: '/', handler: testHandler, tos: 'none', authentication: 'none' }
                    ];

                Hapi.Process.initialize({

                    name: 'Test API Server'
                });
                
                var s = new Hapi.Server.Server(host, port, options, routes);
                // s.on("replied", function(event){
                //   var req = event.request,
                //       res = event.response
                  
                //   console.log(event)
                // })
                // s.on('ops', require('./monitors/ops.schema'))
                s.start();

                request('http://' + host + ":" + port + "/", function(err, r, body){
                  r.statusCode.should.equal(200);
                  body.should.equal("ohai");
                  s.stop();
                  done();
                })
            })
        })
    })
})