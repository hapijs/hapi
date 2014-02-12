// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.route({ path: '/test2', method: 'GET', handler: function (request, reply) { reply('testing123'); } });
    plugin.route({ path: '/test2/path', method: 'GET', handler: function (request, reply) { reply(plugin.path); } });
    plugin.log('test', 'abc');
    return next();
};

