var assert = require('assert');
var hapi = require('../../lib/hapi');
var should = require("should");
var sinon = require("sinon");
var utils = require("../../lib/utils");

describe("utils", function(){
  var emptyObj = {};
  var nestedObj = {
    x: 'x',
    y: 'y'
  }
  var dupsArray = [nestedObj, {z:'z'}, nestedObj];
  var reducedDupsArray = [nestedObj, {z:'z'}];
  
  describe("#getTimestamp", function(){
    it("should return a valid unix timestamp", function(done){
      (function(){
        var ts = utils.getTimestamp();
        ts.should.be.a('number');
        var datetime = new Date(ts);
        (typeof datetime).should.equal('object');
      }).should.not.throw();
      done();
    })
  })
  
  describe("#clone", function(){
    it("should clone a nested object", function(done){
      var a = nestedObj;
      var b = utils.clone(a);
      
      assert.deepEqual(a, b);
      done();
    })
  })
  
  describe("#merge", function(){
    it("should", function(done){
      var a = emptyObj;
      var b = nestedObj;
      
      var c = utils.merge(a, b);
      assert.deepEqual(a, b);
      assert.deepEqual(c, b);
      done();
    })
  })
  
  describe("#unique", function(){
    it("should ensure uniqueness within array of objects based on subkey", function(done){
      var a = utils.unique(dupsArray, 'x');
      assert.deepEqual(a, reducedDupsArray);
      done();
    })
  })
  
  describe("#map", function(){
    it("should convert basic array to existential object", function(done){
      var keys = [1,2,3,4];
      var a = utils.map(keys);
      for(var i in keys){
        a[keys[i]].should.equal(true);
      }
      done();
    })
    
    it("should convert array of objects to existential object", function(done){
      var keys = [{x:1}, {x:2}, {x:3}];
      var subkey = 'x';
      var a= utils.map(keys, subkey);
      for(var i in keys){
        a[keys[i][subkey]].should.equal(true);
      }
      done();
    })
  })

  // #checkEmail was removed in 78435467c133416ea03465845b32026365d79bf8
  // describe("#checkEmail", function(){
  //   var validEmail = "ehammer@walmart.com",
  //       invalidEmail = "ohai";
    
  //   it("should return false on invalid email", function(done){
  //     utils.checkEmail(invalidEmail).should.equal(false);
  //     done();
  //   })
    
  //   it("should return true on valid email", function(done){
  //     utils.checkEmail(validEmail).should.equal(true);
  //     done();
  //   })
  // })
  
  describe("#hide", function(){
    var objWithHiddenKeys = {
      location: {
        name: 'San Bruno'
      },
      company: {
        name: "@WalmartLabs"
      }
    }
    
    it("should delete params with definition's hide set to true", function(done){
      var a = utils.hide(objWithHiddenKeys, {location: {hide: true}});
      should.not.exist(objWithHiddenKeys.location);
      should.exist(objWithHiddenKeys.company);
      done();
    })
  })
})