// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var bind = {
        value: 'in context',
        suffix: ' throughout'
    };

    plugin.route({ method: 'GET', path: '/', handler: internals.handler });

    plugin.ext('onPreResponse', internals.ext);

    plugin.bind(bind);        // Call last to test late binding

    next();
};


internals.handler = function (request, reply) {

    reply(this.value);
};


internals.ext = function (request, next) {

    request.response()._payload.push(this.suffix);
    next();
};
