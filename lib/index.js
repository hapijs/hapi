// Declare internals

var internals = {
    modules: {
        error: require('boom'),
        boom: require('boom'),
        log: require('good').log,
        server: require('./server'),
        response: require('./response'),
        utils: require('./utils'),
        types: require('joi').Types,
        pack: require('./pack')
    }
};


// Export public modules

internals.export = function () {

    for (var key in internals.modules) {
        if (internals.modules.hasOwnProperty(key)) {
            exports[key] = exports[key.charAt(0).toUpperCase() + key.slice(1)] = internals.modules[key];
        }
    }
};

internals.export();

