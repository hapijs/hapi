// Load modules

var Fs = require('fs');
var Path = require('path');
var NodeUtil = require('util');
var Stream = require('./stream');
var Mime = require('mime');
var Err = require('../error');
var Utils = require('../utils');


// Declare internals

var internals = {};


// File response  (Base -> Generic -> Stream -> File)

exports = module.exports = internals.File = function (filePath) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');

    this._filePath = Path.normalize(filePath);
    this._tag = 'file';

    return this;
};

NodeUtil.inherits(internals.File, Stream);


internals.File.prototype._prepare = function (callback) {

    var self = this;
    Fs.stat(self._filePath, function(err, stat) {

        if (err) {
            return callback(Err.notFound('File not found'));
        }

        if (stat.isDirectory()) {
            return callback(Err.forbidden('No directory access'));
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