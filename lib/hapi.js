// Declare internals

var internals = {
    modules: {
        error: require('./error'),
        log: require('./log'),
        server: require('./server'),
        utils: require('./utils'),
        session: require('./session'),
        types: require('joi').Types
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

