// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var loadUser = function (username, password, callback) {

        if (username === 'john') {
            return callback(null, password === '12345', { user: 'john' });
        }

        return callback(null, false);
    };

    plugin.auth.strategy('basic', 'basic', 'required', { validateFunc: loadUser });

    plugin.auth.scheme('special', function () { return { authenticate: function () { } } });
    plugin.auth.strategy('special', 'special', {});

    return next();
};

