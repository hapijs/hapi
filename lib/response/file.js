// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Stream = require('./stream');
var Mime = require('mime');
var Err = require('../error');
var ErrorResponse = require('./error');


// Declare internals

var internals = {};


// File response

exports = module.exports = internals.File = function (filePath, callback) {

    var self = this;
    Fs.stat(filePath, function(err, stat) {

        if (err) {
            self = new ErrorResponse(Err.notFound('File not found').toResponse());
            return callback(self);
        }

        var stream = Fs.createReadStream(filePath);
        Stream.call(self, stream);
        self._tag = 'file';
        self.headers['Content-Type'] = Mime.lookup(filePath) || 'application/octet-stream';
        self.headers['Content-Length'] = stat.size;
        self.headers['Last-Modified'] = new Date(stat.mtime).toUTCString();

        return callback(self);
    });
};

NodeUtil.inherits(internals.File, Stream);