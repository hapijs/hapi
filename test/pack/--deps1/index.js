// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    plugin.dependency('--deps2', internals.after);

    plugin.select('a').ext('onRequest', function (request, cont) {
        
        request.app.deps = request.app.deps || '|';
        request.app.deps += '1|'
        cont();
    }, { after: '--deps3' });

    return next();
};


internals.after = function (plugin, next) {

    plugin.expose('breaking', plugin.plugins['--deps2'].breaking);

    next();
};
