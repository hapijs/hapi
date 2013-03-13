// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.select({ label: 'c' }).ext('onRequest', function (request, cont) {
        
        request.plugins.deps = request.plugins.deps || '|';
        request.plugins.deps += '3|'
        cont();
    });

    return next();
};
