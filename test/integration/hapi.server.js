// var request = require('request');
// var should = require("should");
// var Hapi = require("../index");

// var testHandler = function(hapi, reply) {

//     reply("ohai");
// }

// describe("Hapi", function() {

//     describe(".Server", function() {

//         describe("#Server", function() {

//             var host = "localhost",
//                 routes = [
//                     { method: 'GET',  path: '/', handler: testHandler, tos: 'none', authentication: 'none' }
//                 ];

//             it("should initialize, start, and stop", function(done) {
//                 var port = 3000,
//                     options = {
//                         name: 'Test API Server'
//                     };

//                 Hapi.Process.initialize(options);
//                 var s = new Hapi.Server.Server(host, port, options, routes);
//                 s.start();

//                 request('http://' + host + ":" + port + "/", function(err, r, body) {

//                     r.statusCode.should.equal(200);
//                     body.should.equal("ohai");
//                     s.stop();
//                     done();
//                 })
//             })

//             // it("should run fine with monitoring", function(done){
//             //     var port = 3001,
//             //         options = {
//             //             name: 'Test API Server',
//             //             monitor: {
//             //                 request: {
//             //                   "http://localhost:9000/analytics/blammo": null
//             //                 },
//             //                 ops: {
//             //                   "http://localhost:9000/analytics/blammo": null
//             //                 },
//             //                 log: {
//             //                   "http://localhost:9000": {
//             //                     uri: "/analytics/log"
//             //                   }
//             //                 },
//             //                 interval: 15000
//             //             }
//             //         };
                
//             //     // Hapi.Process.initialize(options);
//             //     var s = new Hapi.Server.Server(host, port, options, routes);
//             //     // s.start()
//             //     // s.stop()
//             //     done();
//             // })
//         })
//     })
// })