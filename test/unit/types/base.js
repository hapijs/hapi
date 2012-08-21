var should = require("should");

var BaseType = require("../../../lib/types/base");
var Utils = require("../../../lib/utils");

describe("BaseType", function(){
  describe("#_required", function(){
    it('should return true for if input is given and required', function(done){
      var base = new BaseType();
      var result = base._required(true)("walmart");
      should.exist(result);
      result.should.equal(true)
      done();
    })
    
    it('should return true if input is given but not required', function(done){
      var base = new BaseType();
      var result = base._required(false)("walmart");
      should.exist(result);
      result.should.equal(true);
      done();
    })
    
    it('should return false if input is not given but required', function(done){
      var base = new BaseType();
      var result = base._required(true)();
      should.exist(result);
      result.should.equal(false);
      done();
    })
    
    it('should return true if input is not given and not required', function(done){
      var base = new BaseType();
      var result = base._required(false)();
      should.exist(result);
      result.should.equal(true);
      done();
    })
  })
  
  describe("#_rename", function(){
    var key = "name";
    var key2 = "note";
    var key3 = "username";
    var qstr = {name: "van", note: "author"};
    var value = qstr[key];
    var value2 = qstr[key2];
    
    it("should alias a variable with default options", function(done){
      var base = new BaseType();
      var validator = base._rename(key3);
      var q = Utils.clone(qstr);
      var result = validator(value, q, key);
      
      should.exist(q[key3]);
      q[key3].should.equal(value);
      done();
    })
    
    it("should move variable if deleteOrig set", function(done){
      var base = new BaseType();
      var validator = base._rename(key3, {deleteOrig: true});
      var q = Utils.clone(qstr);
      var result = validator(value, q, key);
      
      should.exist(q[key3]);
      should.not.exist(q[key]);
      q[key3].should.equal(value);
      done();
    })
    
    it("should overwrite existing variable if allowOverwrite set", function(done){
      var base = new BaseType();
      var key2 = "note";
      var validator = base._rename(key2, {allowOverwrite: true});
      var q = Utils.clone(qstr);
      var result = validator(value, q, key)
      
      should.exist(q[key2]);
      q[key2].should.equal(value);
      q[key].should.equal(value);
      done();
    })
    
    it("should not overwrite existing variable if allowOverwrite not set", function(done){
      var base = new BaseType();
      var validator = base._rename(key2, {allowOverwrite: false});
      var q = Utils.clone(qstr);
      var result = validator(value, q, key);
      
      should.exist(result);
      result.should.equal(false);
      
      should.exist(q[key2]);
      q[key2].should.equal(value2);
      q[key].should.equal(value); // Original value not deleted
      done();
    })
    
    it("should not allow two renames to set the same key if allowMult not set", function(done){
      var base = new BaseType();
      var q = Utils.clone(qstr);
      var validator = base._rename(key3, {allowMult: false})
      var result = validator(value, q, key);
      
      var validator = base._rename(key3, {allowMult: false})
      var result = validator(value2, q, key2);
      
      result.should.equal(false);
      
      // first _rename will not be rolled back
      should.exist(q[key3]);
      q[key3].should.equal(value);
      done();
    })
  })
})