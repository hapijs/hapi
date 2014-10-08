// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    if (options.route) {
        plugin.register(require('../../--test1'), options, next);
    }
    else {
        plugin.register(require('../../--test1'), next);
    }
};


exports.register.attributes = {
    pkg: require('../package.json')
};
