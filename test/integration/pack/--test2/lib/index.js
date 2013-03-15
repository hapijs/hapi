// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.route({ path: '/test2', method: 'GET', handler: function () { this.reply('testing123'); } });
    return next();
};

