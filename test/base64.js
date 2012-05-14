var assert = require('assert');
var b64 = require("../lib/base64");
var should = require("should");

describe("base64", function(){
  var source = "World of WalmartLabs",
      encoded = "V29ybGQgb2YgV2FsbWFydExhYnM=";
  
  describe("#encode", function(){
    it("should encode known sample to known encoding", function(done){
      b64.encode(source).should.equal(encoded);
      done();
    })
  })
  
  describe("#decode", function(){
    it("should decode known encoding to known sample", function(done){
      b64.decode(encoded).should.equal(source);
      done();
    })
  })
})