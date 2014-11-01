// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    console.log('loaded');

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
