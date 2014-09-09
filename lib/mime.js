// Load modules

var Path = require('path');
var Hoek = require('hoek');
var MimeDb = require('mime-db');


// Declare internals

var internals = {
    byExtension: {},
    byType: {}
};


internals.compressibleRx = /^text\/|\+json$|\+text$|\+xml$/;


internals.compile = function () {

    internals.byType = Hoek.clone(MimeDb);
    var keys = Object.keys(internals.byType);

    for (var i = 0, il = keys.length; i < il; i++) {
        var type = keys[i];
        var mime = internals.byType[type];
        mime.type = type;
        mime.source = mime.source || 'mime-db';
        mime.extensions = mime.extensions || [];
        mime.compressible = (mime.compressible !== undefined ? mime.compressible : internals.compressibleRx.test(type));

        for (var j = 0, jl = mime.extensions.length; j < jl; j++) {
            var ext = mime.extensions[j];
            internals.byExtension[ext] = mime;
        }
    }
};

internals.compile();


exports.path = function (path) {

    var extension = Path.extname(path).slice(1);
    return internals.byExtension[extension] || {};
};


exports.type = function (type) {

    type = type.split(';', 1)[0].trim().toLowerCase();
    var mime = internals.byType[type];
    if (!mime) {
        mime = {
            type: type,
            source: 'hapi',
            extensions: [],
            compressible: internals.compressibleRx.test(type)
        };

        internals.byType[type] = mime;
    }

    return mime;
};
