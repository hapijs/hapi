// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.select('c').ext('onRequest', function (request, reply) {

        request.app.deps = request.app.deps || '|';
        request.app.deps += '3|';
        return reply.continue();
    });

    return next();
};


exports.register.attributes = {
    pkg: require('./package.json')
};
