// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, next) {

    var route = { path: '/test', method: 'GET', handler: function () { this.reply('testing123'); } };
    this.select({ label: 'test' }).route(route);
    this.api(internals.math);
    this.api(internals.text);

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


