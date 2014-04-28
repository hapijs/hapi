// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var bind = {
        value: 'in context',
        suffix: ' throughout'
    };

    plugin.route({
        method: 'GET',
        path: '/',
        handler: function (request, reply) {

            reply(this.value);
        }
    });

    plugin.ext('onPreResponse', function (request, next) {

        next(request.response.source + this.suffix);
    });

    plugin.bind(bind);        // Call last to test late binding

    next();
};

