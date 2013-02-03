// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    var route = { path: '/test', method: 'GET', handler: function () { this.reply('testing123'); } };
    pack.select({ label: 'test' }).route(route);
    pack.api(internals.math);
    pack.api(internals.text);

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


