var monitor = require("../lib/monitor");
var should = require("should");

describe("monitor", function(){
  describe('#cpu', function(){
    it("should", function(done){
      var mem = monitor.memory();
      console.log(mem);
      
      var output = monitor.cpu(function(err, response){
        done();
      });
    })
  })
})