// Load modules

var Async = require('async');
var Server = require('./server');
var Pack = require('./pack');
var Utils = require('./utils');


// Declare internals

var internals = {};

/*
var config = [{
    pack: {
        cache: 'redis'
    }
    servers: [
        {
            port: 8001,
            options: {
                labels: ['api', 'nasty']
            }
        },
        {
            host: 'localhost',
            port: 8002,
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
    },
    permissions: {
        ext: true
    }
}];
*/

exports = module.exports = internals.Composer = function (manifest) {

    this.settings = Utils.clone(manifest);
    if (this.settings instanceof Array === false) {
        this.settings = [this.settings];
    }

    this._packs = [];

    return this;
};


internals.Composer.prototype.compose = function (callback) {

    var self = this;

    // Create packs

    var sets = [];
    this.settings.forEach(function (set) {

        Utils.assert(set.servers && set.servers.length, 'Pack missing servers definition');
        
        var pack = new Pack(set.pack);

        // Load servers

        set.servers.forEach(function (server) {

            pack.server(server.host, server.port, server.options);
        });

        sets.push({ pack: pack, plugins: set.plugins, permissions: set.permissions });
        self._packs.push(pack);
    });

    // Register plugins

    Async.forEachSeries(sets, function (set, next) {

        set.pack.allow(set.permissions || {}).require(set.plugins, next);
    },
    function (err) {

        return callback(err);
    });
};


internals.Composer.prototype.start = function (callback) {

    Async.forEachSeries(this._packs, function (pack, next) {

        pack.start(next);
    },
    function (err) {

        Utils.assert(!err, 'Failed starting plugins: ' + (err && err.message));
        return callback();
    });
};


internals.Composer.prototype.stop = function () {

    this._packs.forEach(function (pack) {

        pack.stop();
    });
};


