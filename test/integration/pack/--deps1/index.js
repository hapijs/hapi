// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.dependency('--deps2');

    pack.select('a').ext('onRequest', function (request, cont) {
        
        request.app.deps = request.app.deps || '|';
        request.app.deps += '1|'
        cont();
    }, { after: '--deps3' });

    return next();
};
