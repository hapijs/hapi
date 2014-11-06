// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.select('b').ext('onRequest', function (request, reply) {

        request.app.deps = request.app.deps || '|';
        request.app.deps += '2|';
        return reply.continue();
    }, { after: '--deps3', before: '--deps1' });

    plugin.expose('breaking', 'bad');

    return next();
};


exports.register.attributes = {
    pkg: require('./package.json')
};
