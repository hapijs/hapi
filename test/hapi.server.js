var should = require("should");
var Hapi = require("../index");

var testHandler = function(hapi, reply){
  reply("ohai")
}

describe("Hapi", function(){
  describe(".Server", function(){
    describe("#Server", function(){
      it("should", function(done){
        var host = "localhost",
            port = 3000,
            options = {
              
            },
            routes = [
              { method: 'GET',    path: '/',  handler: testHandler, tos: 'none', authentication: 'none' }
            ]
        
        var s = new Hapi.Server.Server(host, port, options, routes);
        done()
      })
    })
  })
})