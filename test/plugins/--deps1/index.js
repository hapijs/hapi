// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.dependency('--deps2', internals.after);

    plugin.select('a').ext('onRequest', function (request, reply) {

        request.app.deps = request.app.deps || '|';
        request.app.deps += '1|';
        return reply.continue();
    }, { after: '--deps3' });

    return next();
};


exports.register.attributes = {
    pkg: require('./package.json')
};


internals.after = function (plugin, next) {

    plugin.expose('breaking', plugin.plugins['--deps2'].breaking);

    return next();
};
