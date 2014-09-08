// Load modules

var MimeDb = require('mime-db');
var Path = require('path');

// Declare internals
var internals = {};
internals.types = {};


internals.compile = function () {

    var map = {};
    var keys = Object.keys(MimeDb);

    // Create an internal object to retrieve a mime type based on the extension
    for (var i = 0, il = keys.length; i < il; i++) {
        var name = keys[i];
        var mime = MimeDb[name];
        mime.name = name;
        var extensions = mime.extensions || [];

        for (var j = 0, jl = extensions.length; j < jl; j++) {

            var ext = extensions[j];
            map[ext] = mime;
        }
    }

    return map;
};


internals.types = internals.compile();


exports.fromPath = function (path) {

    if (typeof path !== 'string') {
        return false;
    }

    var extension = Path.extname(path).slice(1);

    return internals.types[extension] || false;
};
