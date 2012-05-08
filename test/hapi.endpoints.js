// var request = require("request");
// var should = require('should');
// var Hapi = require("../index.js");

// describe('Hapi', function(){
//   describe('endpoint handlers', function(){
//     var config, endpoints, indexHandler, msgBody, server;
    
//     beforeEach(function(done){
//       // This should be a minimal set of configuration required to start server.
//       //  Note: the following config is already pretty hefty...
//       config = {
//         uri: "http://localhost:3000" // TODO: make port parametric via shell var
//       };
//       msgBody = { status: 'ok' };
//       indexHandler = function(req, reply){
//         reply(msgBody);
//       }
//       endpoints = [
//         { method: 'GET', path: '/', handler: indexHandler, authentication: 'none'}
//       ];
//       Hapi.Process.initialize({
//         name: 'Test API Server'
//       });
//       server = Hapi.Server.create('localhost', 3000, config, endpoints);
//       server.start();
      
//       done();
//     })
//     afterEach(function(done){
//       server.stop();
      
//       done();
//     })
    
//     it("should return expected response for basic get handler", function(done){      
//       request(config.uri + "/", function(err, res, body){
//         should.not.exist(err);
//         res.should.have.property('statusCode');
//         res.statusCode.should.equal(200);
//         JSON.parse(body).status.should.equal(msgBody.status);
        
//         done();
//       })
//     })
    
//     it("should return expected response for basic get handler after afterEach & beforeEach call", function(done){      
//       request(config.uri + "/", function(err, res, body){
//         should.not.exist(err);
//         res.should.have.property('statusCode');
//         res.statusCode.should.equal(200);
//         JSON.parse(body).status.should.equal(msgBody.status);
        
//         done();
//       })
//     })
//   })
// })