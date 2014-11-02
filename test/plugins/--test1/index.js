// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var handler = function (request, reply) {

        reply('testing123' + ((plugin.settings.app && plugin.settings.app.my) || ''));
    };

    plugin.select('test').route({ path: '/test1', method: 'GET', handler: handler });
    plugin.expose(internals.math);
    plugin.expose('glue', internals.text.glue);
    plugin.expose('prefix', plugin.config.route.prefix);

    return next();
};


exports.register.attributes = {
    name: '--test1',
    version: '1.0.0'
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
