// Load modules

var Nipple = require('nipple');
var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.main = function () {

    var server = new Hapi.Server(8000);

    var mapper = function (request, callback) {

        callback(null, 'http://www.google.com/search?q=' + request.params.term);
    };

    var postResponse = function (request, reply, res, settings, ttl) {

        if (res.statusCode !== 200) {
            return reply(Boom.badGateway());
        }

        Nipple.read(res, function (err, payload) {

            if (err) {
                return reply(err);
            }
            
            var contentType = res.headers['content-type'];

            var response = reply(payload);
            if (ttl) {
                response.ttl(ttl);
            }

            if (contentType) {
                response.type(contentType);
            }

        });
    };

    server.route({ method: '*', path: '/{p*}', handler: { proxy: { host: 'google.com', port: 80, redirects: 5 } } });
    server.route({ method: 'GET', path: '/hapi/{term}', handler: { proxy: { mapUri: mapper } } });
    server.start();
};


internals.main();
