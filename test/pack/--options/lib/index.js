// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    console.log('app.my: %s, options.key: %s', plugin.app.my, options.key);

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
