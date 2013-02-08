// Load modules

var Fs = require('fs');
var Path = require('path');
var NodeUtil = require('util');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('../utils');
var Stream = require('./stream');


// Declare internals

var internals = {};


// File response  (Base -> Generic -> Stream -> File)

exports = module.exports = internals.File = function (filePath) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');

    Stream.call(this, null);
    this.variety = 'file';
    this.varieties.file = true;

    this._filePath = Path.normalize(filePath);

    return this;
};

NodeUtil.inherits(internals.File, Stream);


internals.File.prototype._prepare = function (request, callback) {

    var self = this;
    Fs.stat(self._filePath, function (err, stat) {

        if (err) {
            return callback(Boom.notFound());
        }

        if (stat.isDirectory()) {
            return callback(Boom.forbidden());
        }

        var fileName = Path.basename(self._filePath);
        var stream = Fs.createReadStream(self._filePath);
        Stream.call(self, stream);
        self._headers['Content-Type'] = Mime.lookup(self._filePath) || 'application/octet-stream';
        self._headers['Content-Length'] = stat.size;
        self._headers['Last-Modified'] = new Date(stat.mtime).toUTCString();
        self._headers.etag = JSON.stringify([stat.ino, stat.size, Date.parse(stat.mtime)].join('-'));
        self._headers['Content-Disposition'] = 'inline; filename=' + encodeURIComponent(fileName);

        return Stream.prototype._prepare.call(self, request, callback);
    });
};