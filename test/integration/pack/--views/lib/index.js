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
            path: '/view', method: 'GET', handler: function () {

                return this.reply.view('test', { message: options.message });
            }
        },
        {
            path: '/file', method: 'GET', handler: { file: './templates/test.html' }
        }
    ]);

    plugin.ext('onRequest', function (request, next) {

        if (request.path === '/ext') {
            return next(request.generateView('test', { message: 'grabbed' }));
        }

        return next();
    });

    return next();
};
