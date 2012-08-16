var should = require("should");
var qs = require("querystring");

var Validation = require("../../lib/validation");
var Types = require("../../lib/types");
var S = Types.String,
    N = Types.Number;

var OhaiHandler = function (hapi, reply) {
  reply('ohai');
};

var createRequestObject = function(query){
  var qstr = qs.stringify(query);
  return {
    httpVersion: '1.1',
    url: '/?' + qstr,
    method: 'GET',
    hapi: {
      server: {},
      url: '/?' + qstr,
      query: query,
      params: {}
    }
  }
}

describe("Validation", function(){
  describe("#validateQuery", function(){
    describe("using Types.String", function(){
      describe("#required", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().required()}};
        
        it("should raise error on undefined REQUIRED parameter", function(done){
          var query = {}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it('should not raise error on defined REQUIRED parameter', function(done){
          var query = {username: "walmart"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
        
        it('should not raise error on undefined OPTIONAL parameter', function(done){
          var modifiedRoute = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().required(), name: S()}};
          var query = {username: "walmart"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, modifiedRoute.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
    })
    
    // TODO: deprecate these
    describe("string and number types", function(){
      var OhaiRoute = { method: 'GET', path: '/', handler: OhaiHandler, query: {name: S().min(2).max(10), age: N().min(0)} }
      var validOhaiQuery = {
        name: "van",
        age: ""+new Date().getFullYear() - 1985
      }
      var validIncomingRequest = createRequestObject(validOhaiQuery);
      var invalidOhaiQuery = {
        name: "v",
        age: "x"
      }
      var invalidIncomingRequest = createRequestObject(invalidOhaiQuery)
      
      it("should validate known working configuration", function(done){
        Validation.validateQuery(validIncomingRequest, OhaiRoute.query, function(err){
          should.not.exist(err);
          done();
        })
      })
      
      it("should invalid known non-working configuration", function(done){
        Validation.validateQuery(invalidIncomingRequest, OhaiRoute.query, function(err){
          should.exist(err);
          done();
        })
      })
    })
  })
})