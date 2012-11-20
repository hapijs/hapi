// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Stream = require('./stream');
var Mime = require('mime');
var Err = require('../error');
var ErrorResponse = require('./error');


// Declare internals

var internals = {};


// File response  (Base -> Generic -> Stream -> File)

exports = module.exports = internals.File = function (filePath) {

    this._filePath = filePath;
    this._tag = 'file';

    return this;
};

NodeUtil.inherits(internals.File, Stream);


internals.File.prototype._prepare = function (callback) {

    var self = this;
    Fs.stat(self._filePath, function(err, stat) {

        if (err) {
            self = new ErrorResponse(Err.notFound('File not found').toResponse());
            return callback(self);
        }

        var stream = Fs.createReadStream(self._filePath);
        Stream.call(self, stream);
        self.headers['Content-Type'] = Mime.lookup(self._filePath) || 'application/octet-stream';
        self.headers['Content-Length'] = stat.size;
        self.headers['Last-Modified'] = new Date(stat.mtime).toUTCString();
        self.headers.etag = JSON.stringify([stat.ino, stat.size, Date.parse(stat.mtime)].join('-'));

        return callback(self);
    });
};