var monitor = require("../lib/monitor");
var should = require("should");

describe("monitor", function(){
  describe('#cpu', function(){
    it("should return a fixed-decimal percentage string", function(done){
      monitor.cpu(function(err, percentage){
        should.not.exist(err);
        should.exist(percentage);
        // percentage.should.have.length(4);
        done();
      });
    })
    
    it("should be able to target a core by /proc/stat name", function(done){
      var output = monitor.cpu("cpu0", function(err, percentage) {
        should.not.exist(err);
        should.exist(percentage);
        done();
      })
    })
  })
  
  describe("#pcpu", function(){
    it("should return a string", function(done){
      monitor.pcpu(function(err, percentage) {
        should.not.exist(err);
        should.exist(percentage);
        
        done();
      })
    })
  })
  
  describe("#memory", function() {
    it("should return used & total values", function(done){
      var output = monitor.memory();
      
      should.exist(output);
      should.exist(output.total);
      should.exist(output.used);
      
      done();
    })
  });
  
  describe("#uptime", function(){
    it("should return ", function(done){
      var uptime = monitor.uptime();
      should.exist(uptime);
      done();
    })
  })
  
  // describe("")
})