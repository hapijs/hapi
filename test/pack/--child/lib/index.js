// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.require('hapi-plugin-test', {}, next);
};

