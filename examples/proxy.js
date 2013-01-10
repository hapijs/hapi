// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var http = new Hapi.Server('0.0.0.0', 8080);

    var map = function (request, callback) {

        var url = 'http://api-groceries-qa2.asda.com/api/' + request.params.api + request.url.search;
        console.log(url);
        return callback(null, url);
    };

    http.addRoute({ method: 'GET', path: '/api/{api*}', handler: { proxy: { mapUri: map } } });

    http.start();
};


internals.main();
