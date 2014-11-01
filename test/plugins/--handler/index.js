// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.path(__dirname);

    plugin.route({
        method: 'GET',
        path: '/handler/{file*}',
        handler: {
            directory: {
                path: './'
            }
        }
    });

    return next();
};


exports.register.attributes = {
    pkg: require('./package.json')
};
