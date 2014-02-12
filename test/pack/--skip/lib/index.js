// Plugin registration

exports.register = function (plugin, next) {

    var route = { path: '/test', method: 'GET', handler: function (request, reply) { reply('testing123'); } };
    this.select('test').route(route);

    return next();
};
