// Load modules

var Crypto = require('crypto');
var Path = require('path');
var Hoek = require('hoek');


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


exports.cloneWithShallow = function (source, keys) {

    if (!source ||
        typeof source !== 'object') {

        return source;
    }

    // Move shallow copy items to storage

    var storage = {};
    for (var i = 0, il = keys.length; i < il; ++i) {
        var key = keys[i];
        if (source.hasOwnProperty(key)) {
            storage[key] = source[key];
            source[key] = null;
        }
    }

    // Deep copy the rest

    var copy = Hoek.clone(source);

    // Shallow copy the stored items

    for (i = 0; i < il; ++i) {
        var key = keys[i];
        if (storage.hasOwnProperty(key)) {
            source[key] = storage[key];
            copy[key] = storage[key];
        }
    }

    return copy;
};