// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.views({
        engines: { 'html': 'handlebars' },
        path: './templates'
    });
    pack.route([
        {
            path: '/view', method: 'GET', handler: function () {

                return this.reply.view('test', { message: options.message });
            }
        },
        {
            path: '/file', method: 'GET', handler: { file: './templates/test.html' }
        }
    ]);

    return next();
};
