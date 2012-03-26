var monitor = require("../lib/monitor");
var should = require("should");


describe("monitor", function(){
  describe("#os", function(){
    // // Builtins
    // var os = require("os");
    // for(var key in os){
    //   console.log(key)
    //   if (key == 'getNetworkInterfaces'){ continue; }
      
    //   if (os.hasOwnProperty(key) && typeof os[key] == "function"){
    //     describe('#' + key, function(){
    //       it("should return without error", function(done){
    //         monitor.os[key](function(err, response){
    //           should.not.exist(err);
    //           should.exist(response);
    //           done();
    //         })
    //       })
    //     })
    //   }
    // }
    
    describe('#cpu', function(){
      it("should return a fixed-decimal percentage string", function(done){
        monitor.os.cpu(function(err, percentage){
          should.not.exist(err);
          should.exist(percentage);
          done();
        });
      })
    
      it("should be able to target a core by /proc/stat name", function(done){
        var output = monitor.os.cpu("cpu0", function(err, percentage) {
          should.not.exist(err);
          should.exist(percentage);
          done();
        })
      })
    })
  })
  
  describe("#process", function(){
    describe("#cpu", function(){
      it("should return a string", function(done){
        monitor.process.cpu(function(err, percentage){
          should.not.exist(err);
          should.exist(percentage);
          done();
        })
      })
    })
    
    describe("#uptime", function(){
      it("should return without error", function(done){
        monitor.process.uptime(function(err, uptime){
          should.not.exist(err);
          should.exist(uptime);
          done();
        })
      })
    })
  })
  
  // describe("#pcpu", function(){
  //   it("should return a string", function(done){
  //     monitor.pcpu(function(err, percentage) {
  //       should.not.exist(err);
  //       should.exist(percentage);
        
  //       done()
  //     })
  //   })
  // })
  
  // describe("#memory", function() {
  //   it("should return non null value", function(done){
  //     var output = monitor.memory();
      
  //     should.exist(output);
  //     done();
  //   })
    
  //   it('should contain total RAM', function(done){
  //     var output = monitor.memory();
      
  //     should.exist(output.total);
  //     done();
  //   })
    
  //   it('should contain total rss RAM', function(done){
  //     var output = monitor.memory();
      
  //     should.exist(output.rss);
  //     done();
  //   })
    
  //   it('should contain total heap RAM', function(done){
  //     var output = monitor.memory();
      
  //     should.exist(output.heap);
  //     done();
  //   })
  // });
  
  // describe("#uptime", function(){
  //   it("should return ", function(done){
  //     var uptime = monitor.uptime();
  //     should.exist(uptime);
  //     done();
  //   })
  // })
  
  // describe("#disk", function(){
  //   it("should return valid percentage for default filesystem", function(done){
  //     monitor.disk('/', function(err, percentage){
  //       should.not.exist(err)
  //       should.exist(percentage)
  //       percentage.should.be.a("string")
  //       done();
  //     });
  //   })
  // })
})