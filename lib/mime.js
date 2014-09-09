// Load modules

var Path = require('path');
var MimeDb = require('mime-db');


// Declare internals

var internals = {};


internals.compile = function () {

    var map = {};
    var keys = Object.keys(MimeDb);

    for (var i = 0, il = keys.length; i < il; i++) {
        var type = keys[i];
        var mime = MimeDb[type];
        mime.type = type;
        var extensions = mime.extensions || [];

        for (var j = 0, jl = extensions.length; j < jl; j++) {
            var ext = extensions[j];
            map[ext] = mime;
        }
    }

    return map;
};

internals.types = internals.compile();


exports.path = function (path) {

    var extension = Path.extname(path).slice(1);
    return internals.types[extension] || {};
};
