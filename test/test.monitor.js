// var async = require("async");
// var monitor = require("../lib/monitor");
// var should = require("should");

// describe("monitor", function(){
//   describe("#os", function(){
//     // Builtins
//     it("should expose some builtins", function(done){
//       async.parallel(monitor.os.builtins.map(function(d){ return monitor.os[d] }), function(err, result){
//         should.not.exist(err);
        
//         for(var key in monitor.os.builtins){
//           should.exist(result[key])
//         }
        
//         done();
//       })
//     })
    
//     describe('#cpu', function(){
//       it("should return a fixed-decimal percentage string", function(done){
//         monitor.os.cpu(function(err, percentage){
//           should.not.exist(err);
//           should.exist(percentage);
//           done();
//         });
//       })
    
//       it("should be able to target a core by /proc/stat name", function(done){
//         var output = monitor.os.cpu("cpu0", function(err, percentage) {
//           should.not.exist(err);
//           should.exist(percentage);
//           done();
//         })
//       })
//     })
    
//     describe("#disk", function(){
//       it('should return without error', function(done){
//         monitor.os.disk(function(err, response){
//           should.not.exist(err);
//           should.exist(response);
          
//           done();
//         })
//       })
//     })
//   })
  
//   describe("#process", function(){
//     // Builtins
//     it("should expose some builtins", function(done){
//       async.parallel(monitor.process.builtins.map(function(d){ return monitor.process[d] }), function(err, result){
//         should.not.exist(err);
        
//         for(var key in monitor.process.builtins){
//           should.exist(result[key])
//         }
        
//         done();
//       })
//     })
    
//     describe("#cpu", function(){
//       it("should return a string", function(done){
//         monitor.process.cpu(function(err, percentage){
//           should.not.exist(err);
//           should.exist(percentage);
//           done();
//         })
//       })
//     })
    
//     describe("#memory", function(){
//       it("should return without error", function(done){
//         monitor.process.memory(function(err, memory){
//           should.not.exist(err);
//           should.exist(memory);
//           done();
//         })
//       })
//     })
//   })
// })