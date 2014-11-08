// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var handler = function (request, reply) {

        reply('testing123' + ((plugin.settings.app && plugin.settings.app.my) || ''));
    };

    plugin.select('test').route({ path: '/test1', method: 'GET', handler: handler });

    plugin.expose({
        add: function (a, b) {

            return a + b;
        }
    });

    plugin.expose('glue', function (a, b) {

        return a + b;
    });

    plugin.expose('prefix', plugin.config.route.prefix);

    return next();
};


exports.register.attributes = {
    name: '--test1',
    version: '1.0.0'
};
