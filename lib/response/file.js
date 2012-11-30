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
    Fs.stat(self._filePath, function (err, stat) {

        if (err) {
            return callback(Err.notFound('File not found'));
        }

        if (stat.isDirectory()) {
            return callback(Err.forbidden('No directory access'));
        }

        var stream = Fs.createReadStream(self._filePath);
        Stream.call(self, stream);
        self._headers['Content-Type'] = Mime.lookup(self._filePath) || 'application/octet-stream';
        self._headers['Content-Length'] = stat.size;
        self._headers['Last-Modified'] = new Date(stat.mtime).toUTCString();
        self._headers.etag = JSON.stringify([stat.ino, stat.size, Date.parse(stat.mtime)].join('-'));

        return callback(self);
    });
};