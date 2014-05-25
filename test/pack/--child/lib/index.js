// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.register(require('../../--test1'), {}, next);
};


exports.register.attributes = {
    pkg: require('../package.json')
};

