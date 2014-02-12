// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.after(function (plugin, finish) {

        finish(new Error('Not in the mood'));
    });

    return next();
};
