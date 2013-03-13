// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.dependency('--deps2');

    pack.select({ label: 'a' }).ext('onRequest', function (request, cont) {
        
        request.plugins.deps = request.plugins.deps || '|';
        request.plugins.deps += '1|'
        cont();
    }, { after: '--deps3' });

    return next();
};
