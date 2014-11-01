// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.route({ method: 'GET', path: options.path, handler: function (request, reply) { reply(options.path); } });
    return next();
};


exports.register.attributes = {
    name: '--custom',
    version: '1.0.0',
    multiple: true
};
