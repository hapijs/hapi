// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.select('test').route({ path: '/test1', method: 'GET', handler: function () { this.reply('testing123' + ((pack.app && pack.app.my) || '')); } });
    pack.api(internals.math);
    pack.api('glue', internals.text.glue);

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


