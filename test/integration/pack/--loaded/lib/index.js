// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    console.log('loaded');

    return next();
};
