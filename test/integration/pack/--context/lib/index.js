// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var context = {
        value: 'in context',
        suffix: ' throughout'
    };

    plugin.route({ method: 'GET', path: '/', handler: internals.handler });

    plugin.ext('onPreResponse', internals.ext);

    plugin.context(context);        // Call last to test late binding

    next();
};


internals.handler = function (request, reply) {

    reply(reply.context.value);
};


internals.ext = function (request, next, context) {

    request.response()._payload.push(context.suffix);
    next();
};
