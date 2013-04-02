// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    var loadUser = function (id, callback) {

        if (id === 'john') {
            return callback(null, { user: 'john' }, '12345');
        }

        return callback(null, null);
    };

    pack.auth('basic', {
        scheme: 'basic',
        loadUserFunc: loadUser,
        defaultMode: true
    });

    return next();
};

