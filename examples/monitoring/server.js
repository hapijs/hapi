var Hapi = require("./index")
var request = require("request")


// var cli = new Hapi.Client({host: "http://localhost:9000"});
// var data = {
// "timestamp": "120508/113905.492",
// "level": "info",
// "message": "Test API Server Server instance started at http://localhost:3000/"
// }
// cli.post("/analytics/log", data, function(err, res, body) {

//     if (err) throw err;
    
//     console.log(arguments)
// });

// var opts = {
//     uri: "http://localhost:9000/analytics/log",
//     method: "post",
//     json: data
// }

// request(opts, function(err, r, body){
//     console.log(arguments)
// })

var testHandler = function(hapi, reply) {

    reply("ohai");
}

var host = "localhost",
    port = 3000,
    options = {
      monitor: {
        request: {
          "http://localhost:9000/analytics/blammo": null
        },
        ops: {
          "http://localhost:9000/analytics/blammo": null
        },
        log: {
          "http://localhost:9000": {
            uri: "/analytics/log"
          }
        },
        interval: 15000
      }
    },
    routes = [
        { method: 'GET',  path: '/', handler: testHandler, tos: 'none', authentication: 'none' }
    ];

Hapi.Process.initialize({

    name: 'Test API Server'
});

var s = new Hapi.Server.Server(host, port, options, routes);
// s.on("request", function(request, response){
//   console.log(request, response)
// })
// s.on('ops', require('./monitors/ops.schema'))
s.start();