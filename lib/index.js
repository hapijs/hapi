// Declare internals

var internals = {
    modules: {
        error: require('boom'),
        boom: require('boom'),
        server: require('./server'),
        response: require('./response'),
        utils: require('./utils'),
        types: require('joi').Types,
        pack: require('./pack'),
        composer: require('./composer')
    }
};


// Export public modules

internals.export = function () {

    for (var key in internals.modules) {
        if (internals.modules.hasOwnProperty(key)) {
            module.exports[key] = module.exports[key.charAt(0).toUpperCase() + key.slice(1)] = internals.modules[key];
        }
    }

    module.exports.createServer = function () {

        return new module.exports.Server(arguments[0], arguments[1], arguments[2]);
    };
};

internals.export();

