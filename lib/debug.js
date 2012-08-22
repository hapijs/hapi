/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Err = require('./error');


// Declare internals

var internals = {

    events: {}                                  // Map: debug session -> events array
};


exports.report = function (session, event) {

    internals.events[session] = internals.events[session] || [];
    internals.events[session].push(event);
};


exports.session = function (request) {

    if (internals.events[request.params.id]) {

        request.reply(internals.events[request.params.id]);
    }
    else {

        request.reply(Err.notFound());
    }
};

