// Load modules

var Async = require('async');
var Server = require('./server');
var Pack = require('./pack');
var Utils = require('./utils');


// Declare internals

var internals = {};

/*
var config = [{
    servers: {
        ren: {
            port: 8001,
            labels: ['api', 'nasty'],
            config: {
                monitor: {
                    subscribers: {
                        console: ['ops', 'request', 'log']
                    }
                },
                cache: 'redis'
            }
        },
        stimpy: {
            host: 'localhost',
            port: 8002,
            labels: ['api', 'nice']
        }
    },
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

exports = module.exports = internals.Composer = function (config, packOptions) {

    this.settings = Utils.clone(config);
    if (this.settings instanceof Array === false) {
        this.settings = [this.settings];
    }

    this.packs = [];

    this.packOptions = Utils.clone(packOptions);

    return this;
};


internals.Composer.prototype.compose = function (callback) {

    var self = this;

    // Create packs

    var sets = [];
    this.settings.forEach(function (set) {

        Utils.assert(set.servers && Object.keys(set.servers).length, 'Pack missing servers definition');
        
        var pack = new Pack(self.packOptions);
        Object.keys(set.servers).forEach(function (serverName) {

            // Load servers

            var serverOptions = set.servers[serverName];
            pack.server(serverName, new Server(serverOptions.host, serverOptions.port, serverOptions.config), { labels: serverOptions.labels });
        });

        sets.push({ pack: pack, plugins: set.plugins, permissions: set.permissions });
        self.packs.push(pack);
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

    Async.forEachSeries(this.packs, function (pack, next) {

        pack.start(next);
    },
    function (err) {

        Utils.assert(!err, 'Failed starting plugins: ' + (err && err.message));
        return callback();
    });
};


internals.Composer.prototype.stop = function () {

    this.packs.forEach(function (pack) {

        pack.stop();
    });
};


