var Hapi = require("../../index");
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

var s = new Hapi.Server(host, port, options);
s.addRoutes(routes);
s.start();