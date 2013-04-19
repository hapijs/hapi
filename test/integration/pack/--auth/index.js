// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    var loadUser = function (username, password, callback) {

        if (username === 'john') {
            return callback(null, password === '12345', { user: 'john' });
        }

        return callback(null, false);
    };

    pack.auth('basic', {
        scheme: 'basic',
        validateFunc: loadUser,
        defaultMode: true
    });

    return next();
};

