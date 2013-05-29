// Load modules

var Http = require('http');

// Declare internals

var internals = {};


// Plugin registration

exports.register = function (pack, options, next) {

    var server = Http.createServer(function (req, res) {

        res.end();
    });

    server.once('listening', function () {

        pack.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, function (err, res) {

            pack.api({ response: res });
            next();
        });
    });

    server.listen(0);
};
