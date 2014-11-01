// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    return next(new Error('failed'));
};

exports.register.attributes = {
    name: '--fail',
    version: '1.0.0'
};
