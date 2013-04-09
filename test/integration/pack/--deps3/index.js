// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    pack.select('c').ext('onRequest', function (request, cont) {
        
        request.app.deps = request.app.deps || '|';
        request.app.deps += '3|'
        cont();
    });

    return next();
};
