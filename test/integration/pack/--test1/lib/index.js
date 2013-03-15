// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.select({ label: 'test' }).route({ path: '/test1', method: 'GET', handler: function () { this.reply('testing123'); } });
    pack.api(internals.math);
    pack.api(internals.text.glue, 'glue');

    return next();
};


internals.math = {
    add: function (a, b) {

        return a + b;
    }
};


internals.text = {
    glue: function (a, b) {

        return a + b;
    }
};


