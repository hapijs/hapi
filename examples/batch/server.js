/**
 To Test:

 Run the server.
 Try a batch request like the following:

 POST /batch
    { "requests": [{ "method": "get", "path": "/profile" }, { "method": "get", "path": "/item" }, { "method": "get", "path": "/item/$1.id" }]

or a GET request to http://localhost:8080/request will perform the above request for you
 */

// Load modules

var Hapi = require('../../lib/hapi');


// Declare internals

var internals = {};


internals.main = function () {

    var config = {
        batch: true
    };

    // Create Hapi servers

    internals.http = new Hapi.Server('0.0.0.0', 8080, config);

    // Set routes

    internals.http.addRoutes([{ method: 'GET', path: '/profile', handler: internals.profile },
                    { method: 'GET', path: '/item', handler: internals.activeItem },
                    { method: 'GET', path: '/item/{id}', handler: internals.item },
                    { method: 'GET', path: '/request', handler: internals.requestBatch }]);

    // Start Hapi servers

    internals.http.start();
};

internals.requestBatch = function (request) {

    internals.http.inject({
        method: 'POST',
        url: '/batch',
        payload: '{ "requests": [{ "method": "get", "path": "/profile" }, { "method": "get", "path": "/item" }, { "method": "get", "path": "/item/$1.id" }] }'
    }, function (res) {

        request.reply(res.result);
    });
};

internals.profile = function (request) {
    request.reply({
        'id': 'fa0dbda9b1b',
        'name': 'John Doe'
    });
};

internals.activeItem = function (request) {
    request.reply({
        'id': '55cf687663',
        'name': 'Active Item'
    });
};

internals.item = function (request) {
    request.reply({
        'id': request.params.id,
        'name': 'Item'
    });
};

internals.main();