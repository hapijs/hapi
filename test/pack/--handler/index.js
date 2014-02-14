// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.route({
        method: 'GET',
        path: '/handler/{file*}',
        handler: {
            directory: {
                path: 'pack/--handler/'
            }
        }
    });

    return next();
};
