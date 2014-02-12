// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.loader(require);
    plugin.require('--inner', next);
};

