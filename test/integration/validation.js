// var request = require("request");
// var should = require("should");
// var Hapi = require('../../lib/hapi');
// var Types = Hapi.Types;
// var S = Types.String


// var get = function (request) {
//   request.reply('Success!\n');
// };

// describe("Integration", function(){
//   describe("#Validation.query", function(){
//     Hapi.Process.initialize();
//     var config = {};
//     var http = new Hapi.Server.Server('0.0.0.0', 18080, config);
    
//     before(function(done){
//       http.setRoutesDefaults({ authentication: 'none' });
//       http.addRoutes([{ method: 'GET', path: '/test2', config: { handler: get, query: {p1: S().required().rename('itemId')}}}]);
      
//       http.start();
//       Hapi.Process.finalize();
//       done();
//     })
    
//     after(function(done){
//       http.stop && http.stop();
//       done();
//     })
    
//     it('should handle two #rename requests in a row', function(done){
//       done()
//     })
//   })
// })