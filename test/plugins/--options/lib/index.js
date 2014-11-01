// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    // Need to wait until the server starts to make sure that the port can
    // be bound to successfully.
    plugin.events.on('start', function () {

        console.log('app.my: %s, options.key: %s', plugin.app.my, options.key);
    });

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
