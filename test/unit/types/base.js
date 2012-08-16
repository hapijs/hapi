var BaseType = require("../../../lib/types/base");
var should = require("should");

describe("BaseType", function(){
  var base = new BaseType();
  
  describe("#_required", function(){
    it('should work for valid input', function(done){
      var result = base._required(true)("walmart");
      should.exist(result);
      result.should.equal(true)
      done();
    })
  })
})