// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.route({ path: '/test2', method: 'GET', handler: function () { this.reply('testing123'); } });
    pack.route({ path: '/test2/path', method: 'GET', handler: function () { this.reply(pack.path); } });
    pack.log('test', 'abc');
    return next();
};

