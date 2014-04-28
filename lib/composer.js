// Load modules

var Async = require('async');
var Pack = require('./pack');
var Utils = require('./utils');


// Declare internals

var internals = {};

/*
var config = [{
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
}];
*/

exports = module.exports = internals.Composer = function (manifest, options) {

    this._manifest = Utils.clone([].concat(manifest));
    this._settings = Utils.clone(options || {});
    this._packs = [];
};


internals.Composer.prototype.compose = function (callback) {

    var self = this;

    // Create packs

    var sets = [];
    this._manifest.forEach(function (set) {

        Utils.assert(set.servers && set.servers.length, 'Pack missing servers definition');
        Utils.assert(set.plugins, 'Pack missing plugins definition');

        var pack = new Pack(Utils.applyToDefaults(self._settings.pack || {}, set.pack || {}));

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

            pack.server(server.host, server.port, server.options);
        });

        sets.push({ pack: pack, plugins: set.plugins });
        self._packs.push(pack);
    });

    // Register plugins

    Async.forEachSeries(sets, function (set, next) {

        set.pack.require(set.plugins, next);
    },
    function (err) {

        return callback(err);
    });
};


internals.Composer.prototype.start = function (callback) {

    callback = callback || Utils.ignore;

    Async.forEachSeries(this._packs, function (pack, next) {

        pack.start(next);
    },
    function (err) {

        Utils.assert(!err, 'Failed starting plugins:', err && err.message);
        return callback();
    });
};


internals.Composer.prototype.stop = function (options, callback) {

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    callback = callback || Utils.ignore;

    Async.forEach(this._packs, function (pack, next) {

        pack.stop(options, next);
    },
    callback);
};
