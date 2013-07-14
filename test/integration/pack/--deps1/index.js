// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.dependency('--deps2');

    plugin.select('a').ext('onRequest', function (request, cont) {
        
        request.app.deps = request.app.deps || '|';
        request.app.deps += '1|'
        cont();
    }, { after: '--deps3' });

    return next();
};
