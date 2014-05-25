// Load modules

var Async = require('async');
var Hoek = require('hoek');
var Pack = require('./pack');


// Declare internals

var internals = {};

/*
var config = {
    pack: {
        cache: 'redis',
        app: {
            'app-specific': 'value'
        }
    },
    servers: [
        {
            port: 8001,
            options: {
                labels: ['api', 'nasty']
            }
        },
        {
            host: 'localhost',
            port: '$env.PORT',
            options: {
                labels: ['api', 'nice']
            }
        }
    ],
    plugins: {
        furball: {
            version: false,
            plugins: '/'
        }
    }
};
*/

exports = module.exports = internals.Composer = function (manifest, options) {

    this._manifest = Hoek.clone(manifest);
    this._settings = Hoek.clone(options || {});
    this._pack = null;
};


internals.Composer.prototype.compose = function (callback) {

    var self = this;

    // Create pack

    var set = this._manifest;

    Hoek.assert(set.servers && set.servers.length, 'Pack missing servers definition');
    Hoek.assert(set.plugins, 'Pack missing plugins definition');

    this._pack = new Pack(Hoek.applyToDefaults(self._settings.pack || {}, set.pack || {}));

    // Load servers

    set.servers.forEach(function (server) {

        if (server.host &&
            server.host.indexOf('$env.') === 0) {

            server.host = process.env[server.host.slice(5)];
        }

        if (server.port &&
            typeof server.port === 'string' &&
            server.port.indexOf('$env.') === 0) {

            server.port = parseInt(process.env[server.port.slice(5)], 10);
        }

        self._pack.server(server.host, server.port, server.options);
    });

    this._pack.require(set.plugins, callback);
};


internals.Composer.prototype.start = function (callback) {

    callback = callback || Hoek.ignore;

    this._pack.start(function (err) {

        Hoek.assert(!err, 'Failed starting plugins:', err && err.message);
        return callback();
    });
};


internals.Composer.prototype.stop = function (options, callback) {

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    callback = callback || Hoek.ignore;

    this._pack.stop(options, callback);
};
