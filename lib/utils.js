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


// hapi version

exports.version = function () {

    return exports.loadPackage(__dirname + '/..').version;
};


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


exports.isAbsolutePath = function (path) {
    if (path.length === 0) {
        return false;
    }

    if (path[0] === '/') {
        return true;
    }

    if (path.length >= 3 && path[1] === ':' && path[2] === '\\') {
        return true;
    }

    // Microsoft Azure absolute path
    if (path.length >= 2 && path.substring(0, 2) === '\\\\') {
        return true;
    }

    return false;
};
