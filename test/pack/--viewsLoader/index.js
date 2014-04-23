// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.loader(require);

    plugin.views({
        engines: {
            'html': {
                compileMode: 'async',
                module: '--custom'
            }
        },
        path: './templates'
    });

    plugin.route({ path: '/', method: 'GET', handler: function (request, reply) { return reply.view('test', { message: options.message }); } });

    return next();
};
