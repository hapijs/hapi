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
  
  it("should ", function(done){
    var result = S.min(5);
    console.log(result.toString());
    done();
  })
  
  describe("#min", function(){
    it("should exist", function(done){
      
      
      should.exist(Types.String.min);
      done();
    })
  })
  
})