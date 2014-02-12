// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.views({
        engines: { 'html': 'handlebars' },
        path: './templates'
    });

    plugin.route([
        {
            path: '/view', method: 'GET', handler: function (request, reply) {

                return reply.view('test', { message: options.message });
            }
        },
        {
            path: '/file', method: 'GET', handler: { file: './templates/test.html' }
        }
    ]);

    plugin.ext('onRequest', function (request, reply) {

        if (request.path === '/ext') {
            return reply.view('test', { message: 'grabbed' });
        }

        return reply();
    });

    return next();
};
