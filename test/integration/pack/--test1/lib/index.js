// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.select('test').route({ path: '/test1', method: 'GET', handler: function () { this.reply('testing123' + ((plugin.app && plugin.app.my) || '')); } });
    plugin.api(internals.math);
    plugin.api('glue', internals.text.glue);

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


