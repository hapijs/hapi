// Plugin registration

exports.register = function (pack, next) {

    var route = { path: '/test', method: 'GET', handler: function () { this.reply('testing123'); } };
    this.select({ label: 'test' }).route(route);

    return next();
};
