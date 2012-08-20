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

      describe("#min", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().min(7)}};
        
        it("should raise error on input length < min parameter", function(done){
          var query = {username: "van"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input > min parameter", function(done){
          var query = {username: "thegoleffect"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input == min parameter", function(done){
          var query = {username: "walmart"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })

      describe("#max", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().max(7)}};
        
        it("should raise error on input length > max parameter", function(done){
          var query = {username: "thegoleffect"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input < max parameter", function(done){
          var query = {username: "van"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input == max parameter", function(done){
          var query = {username: "walmart"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })


      describe("#regex", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().regex(/^[0-9][-][a-z]+$/)}};
        
        it("should raise error on input not matching regex parameter", function(done){
          var query = {username: "van"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input matching regex parameter", function(done){
          var query = {username: "1-aaaa"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
      
      describe("combinations of #required, #min, #max", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().required().min(5).max(7)}};
        
        it("should raise error when not supplied required input", function(done){
          var query = {name: "van"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should raise error when input length not within min/max bounds", function(done){
          var query = {username: "van"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error when input length is within min/max bounds", function(done){
          var query = {username: "walmart"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })

      describe("#rename", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {username: S().rename("name", {deleteOrig:true}).min(7)}};
        
        it("should apply subsequent validators on the new name AFTER a rename", function(done){
          var query = {username: "thegoleffect"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
    })

    describe("using Types.Number", function(){
      describe("#integer", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().integer()}};
        
        it("should raise error on non-integer input", function(done){
          var query = {num: "1.02"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on integer input", function(done){
          var query = {num: "100"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
      
      describe("#float", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().float()}};
        
        it("should raise error on non-float input", function(done){
          var query = {num: "100"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on float input", function(done){
          var query = {num: "1.02"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
      
      describe("#min", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().min(100)}};
        
        it("should raise error on input < min", function(done){
          var query = {num: "50"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input > min", function(done){
          var query = {num: "102000"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input == min", function(done){
          var query = {num: "100"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })

      describe("#max", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().max(100)}};
        
        it("should raise error on input > max", function(done){
          var query = {num: "120000"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input < max", function(done){
          var query = {num: "50"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on input == max", function(done){
          var query = {num: "100"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })

      describe("#min & #max", function(){
        var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().min(50).max(100)}};
        
        it("should raise error on input > max", function(done){
          var query = {num: "120000"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should raise error on input < min", function(done){
          var query = {num: "25"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.exist(err);
            done();
          })
        })
        
        it("should NOT raise error on min < input < max", function(done){
          var query = {num: "75"}
          var request = createRequestObject(query);
          
          Validation.validateQuery(request, route.query, function(err){
            should.not.exist(err);
            done();
          })
        })
      })
    })

    // describe("using Types.Boolean", function(){
    //   describe("#integer", function(){
    //     var route = {method: 'GET', path: '/', handler: OhaiHandler, query: {num: N().integer()}};
        
    //     it("should raise error on non-integer input", function(done){
    //       var query = {num: "1.02"}
    //       var request = createRequestObject(query);
          
    //       Validation.validateQuery(request, route.query, function(err){
    //         should.exist(err);
    //         done();
    //       })
    //     })
    //   })
    // })
  })
})