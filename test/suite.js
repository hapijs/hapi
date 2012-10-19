// Load modules

var FakeRedis = require('fakeredis');
var libPath = process.env.TEST_COV ? '../lib-cov/' : '../lib/';
var Server = require(libPath + 'server');
var Proxyquire = require('proxyquire');
var Net = require('net');
var Async = require('async');


exports.Server = function(callback) {

    Async.series({
        useRedis: redisPortInUse
    }, function(err, results) {

        if (process.env.USE_REDIS || results.useRedis) {
            exports.Server = function(callback) {
                callback(Server);
            };

            callback(Server);
        }
        else {
            var fakeRedisClient = Proxyquire.resolve(libPath + 'cache/redis', __dirname, { redis: FakeRedis });
            var fakeCache = Proxyquire.resolve(libPath + 'cache/index', __dirname, { './redis': fakeRedisClient });
            var fakeServer = Proxyquire.resolve(libPath + 'server', __dirname, { './cache': fakeCache });

            exports.Server = function(callback) {
                callback(fakeServer);
            };

            callback(fakeServer);
        }
    });

    function redisPortInUse(callback) {
        var connection = Net.createConnection(6379);

        connection.once('error', function() {

            callback(null, false);
        });

        connection.once('connect', function() {

            callback(null, true);
        });
    }
};