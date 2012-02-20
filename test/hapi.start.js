var request = require("request");
var should = require('should');
var Hapi = require("../index.js");

describe('Hapi', function(){
  describe('#start', function(){
    var config, endpoints, indexHandler, msgBody, server;
    
    beforeEach(function(done){
      // This should be a minimal set of configuration required to start server.
      //  Note: the following config is already pretty hefty...
      config = {
        uri: "http://localhost:3000"
      };
      msgBody = { status: 'ok' };
      indexHandler = function(req, reply){
        reply(msgBody);
      }
      endpoints = [
        { method: 'GET', path: '/', handler: indexHandler, authentication: 'none'}
      ];
      Hapi.Process.initialize({
        name: 'Test API Server'
      });
      server = Hapi.Server.create(config, endpoints);
      server.start();
      done();
    })
    afterEach(function(done){
      server.stop();
      done();
    })
    
    it("should return proper response for basic handler", function(done){
      server.start();
      
      request(config.uri + "/", function(err, res, body){
        should.not.exist(err);
        res.statusCode.should.equal(200);
        console.log();
        
        done();
      })
    })
  })
})