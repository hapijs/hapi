// Load modules

var Crypto = require('crypto');
var Path = require('path');


// Declare internals

var internals = {};


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


exports.shallow = function (source) {

    var target = {};
    var keys = Object.keys(source);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var key = keys[i];
        target[key] = source[key];
    }

    return target;
};