// Load modules

var Os = require('os');
var Async = require('async');
var Client = require('./client');


// Declare internals

var internals = {
    package: require(process.env.PWD + '/package.json')
};


// External destinations for logging output

exports.externalStores = null;


// Log event

exports.event = function (tags, data, timestamp) {

    if (process.env.NODE_ENV === 'test') {
        return;                                         // Silence log output during Jenkins test execution
    }

    tags = (tags instanceof Array ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp : new Date(timestamp)) : new Date());

    if (exports.externalStores) {

        // Send to external loggers

        Async.forEach(Object.keys(exports.externalStores), function (host, next) {

            var uri = exports.externalStores[host].uri;
            var cli = new Client({ host: host });

            // Anivia Schema related

            var event = {

                appVer: internals.package.version || '0.0.1',
                host: Os.hostname(),
                module: 'hapi',
                data: [{

                    event: 'log',
                    ts: now.getTime(),
                    tags: tags,
                    data: data
                }]
            };

            cli.post(uri, event, function (err, res, body) {
                return next(err);
            });
        },
        function (err) {
            // Ignore errors
        });
    }
    else {

        // Output to console

        var pad = function (value) {
            return (value < 10 ? '0' : '') + value;
        };

        var timestring = (now.getYear() - 100).toString() +
                         pad(now.getMonth() + 1) +
                         pad(now.getDate()) +
                         '/' +
                         pad(now.getHours()) +
                         pad(now.getMinutes()) +
                         pad(now.getSeconds()) +
                         '.' +
                         now.getMilliseconds();

        console.log(timestring + ', ' + tags[0] + ', ' + (typeof data === 'string' ? data : JSON.stringify(data)));
    }
};



