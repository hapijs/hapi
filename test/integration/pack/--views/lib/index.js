// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.views({ path: './templates' });
    pack.route([
        {
            path: '/view', method: 'GET', handler: function () {

                return this.reply.view('test', { message: options.message }).send();
            }
        },
        {
            path: '/file', method: 'GET', handler: { file: './templates/test.html' }
        }
    ]);

    return next();
};
