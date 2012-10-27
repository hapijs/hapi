// Load modules

var libPath = process.env.TEST_COV ? '../lib-cov/' : '../lib/';
var Server = require(libPath + 'server');
var Net = require('net');
var Async = require('async');


module.exports = function(callback) {

    Async.parallel({
        useRedis: redisPortInUse,
        useMongo: mongoPortInUse
    }, function(err, results) {

        var useMongo = process.env.USE_MONGO || results.useMongo;
        var useRedis = process.env.USE_REDIS || results.useRedis;

        module.exports = function(cb) {
            cb(useRedis, useMongo);
        };

        callback(useRedis, useMongo);
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

    function mongoPortInUse(callback) {
        var connection = Net.createConnection(27017);

        connection.once('error', function() {

            callback(null, false);
        });

        connection.once('connect', function() {

            callback(null, true);
        });
    }
};