var should = require("should");
var qs = require("querystring");

var Validation = require("../../lib/validation");
var Types = require("../../lib/types");
var S = Types.String,
    N = Types.Number;

var OhaiHandler = function (hapi, reply) {
  reply('ohai');
};

describe("Validation", function(){
  describe("#validateQuery", function(){
    describe("string and number types", function(){
      var OhaiRoute = { method: 'GET', path: '/', handler: OhaiHandler, query: {name: S().min(2).max(10), age: N().min(0)} }
      var validOhaiQuery = {
        name: "van",
        age: ""+new Date().getFullYear() - 1985
      }
      var validOhaiQStr = qs.stringify(validOhaiQuery);
      var validIncomingRequest = {
        httpVersion: '1.1',
        url: '/?' + validOhaiQStr,
        method: 'GET',
        hapi: {
          server: {},
          url: '/?' + validOhaiQStr,
          query: validOhaiQuery,
          params: {}
        }
      };
      var invalidOhaiQuery = {
        name: "v",
        age: "x"
      }
      var invalidOhaiQStr = qs.stringify(invalidOhaiQuery);
      var invalidIncomingRequest = {
        httpVersion: '1.1',
        url: '/?' + invalidOhaiQStr,
        method: 'GET',
        hapi: {
          server: {},
          url: '/?' + invalidOhaiQStr,
          query: invalidOhaiQuery,
          params: {}
        }
      };
      
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