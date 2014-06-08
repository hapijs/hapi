// Load modules

var Path = require('path');


// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.path(Path.join(__dirname, '..'));

    var views = {
        engines: { 'html': require('handlebars') },
        path: './templates'
    };

    plugin.views(views);
    if (Object.keys(views).length !== 2) {
        return next(new Error('plugin.view() modified options'));
    }

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


exports.register.attributes = {
    pkg: require('../package.json')
};
