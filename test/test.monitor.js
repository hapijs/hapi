var monitor = require("../lib/monitor");
var should = require("should");

describe("monitor", function(){
  describe('#cpu', function(){
    it("should", function(done){
      var output = monitor.cpu(function(err, response){
        done();
      });
    })
  })
})