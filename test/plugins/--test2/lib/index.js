// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.route({ path: '/test2', method: 'GET', handler: function (request, reply) { reply('testing123'); } });
    plugin.log('test', 'abc');
    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
