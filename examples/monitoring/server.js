var Hapi = require("./index");
var request = require("request");

var testHandler = function(request) {

    request.reply("ohai");
};

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
s.start();