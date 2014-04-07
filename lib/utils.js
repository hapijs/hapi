// Load modules

var Crypto = require('crypto');
var Path = require('path');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Import Hoek Utilities

internals.import = function () {

    Object.keys(Hoek).forEach(function (util) {

        exports[util] = Hoek[util];
    });
};

internals.import();


exports.stringify = function () {

    try {
        return JSON.stringify.apply(null, arguments);
    }
    catch (err) {
        return '[Cannot display object: ' + err.message + ']';
    }
};


exports.uniqueFilename = function (path) {

    var name = [Date.now(), process.pid, Crypto.randomBytes(8).toString('hex')].join('-');
    return Path.join(path, name);
};
