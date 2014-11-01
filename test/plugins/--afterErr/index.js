// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.after(function (plugin, finish) {

        return finish();
    });

    plugin.after(function (plugin, finish) {

        return finish(new Error('Not in the mood'));
    });

    return next();
};


exports.register.attributes = {
    pkg: require('./package.json')
};
