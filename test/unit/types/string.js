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
      should.exist(S.min);
      done();
    })
    
    it("should generate working validator fn", function(done){
      var result = S.min(5);
      var validator = result.valueOf().min;
      
      var str = "aaaaa";
      should.exist(validator(str));
      validator(str).should.equal(true);
      
      var str = "aaaaabbbbbccccc";
      should.exist(validator(str))
      validator(str).should.equal(true);
      
      var str = "a";
      should.exist(validator(str));
      validator(str).should.equal(false);
      
      done();
    })
  })
  
  describe("#max", function(){
    it("should exist", function(done){
      should.exist(S.max);
      done();
    })
    
    it("should generate working validator fn", function(done){
      var result = S.max(5);
      var validator = result.valueOf().max;
      
      var str = "aaaaa";
      should.exist(validator(str));
      validator(str).should.equal(true);
      
      var str = "aaaaabbbbbccccc";
      should.exist(validator(str))
      validator(str).should.equal(false);
      
      var str = "a";
      should.exist(validator(str));
      validator(str).should.equal(true);
      
      done();
    })
  })
  
  describe("#regex", function(){
    it("should exist", function(done){
      should.exist(S.regex);
      done();
    })
    
    describe("validator function", function(){
      var result = S.regex(/^[a-z]+$/);
      var validator = result.valueOf().regex;
      
      it("should validate known valid string", function(done){
        var str = "aaaaa";
        should.exist(validator(str));
        validator(str).should.equal(true);
        done();
      })
      
      it("should invalidate known invalid string", function(done){
        var str = "aaaaa00000ccccc";
        should.exist(validator(str))
        validator(str).should.equal(false);
        done();
      })
    })
  })
})