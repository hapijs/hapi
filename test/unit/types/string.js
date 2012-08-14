var Types = require("../../../lib/types/");
var should = require("should");

describe("Types.String", function(){
  var S = Types.String;
  
  it("should inherit functions from BaseType", function(done){
    var fns = ["required", "optional", "set", "get"];
    
    for(var i in fns){
      should.exist(S[fns[i]]);
      // TODO: confirm type is function
    }
    done();
  })
  
  it("should show resulting object with #valueOf", function(done){
    var result = S.min(5);
    should.exist(result.valueOf());
    done();
  })
  
  describe("#min", function(){
    it("should exist", function(done){
      
      
      should.exist(Types.String.min);
      done();
    })
  })
  
})