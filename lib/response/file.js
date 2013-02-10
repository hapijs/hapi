// Load modules

var Fs = require('fs');
var Path = require('path');
var NodeUtil = require('util');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('../utils');
var Stream = require('./stream');
var LRU = require('lru-cache');
var Crypto = require('crypto');


// Declare internals

var internals = {};
internals.fileEtags = LRU();

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
        
        // Use stat info for an LRU cache key.
        var cachekey = [self._filePath, stat.ino, stat.size, Date.parse(stat.mtime)].join('-');
        
        // The etag must hash the file contents in order to be consistent between nodes.
        if (internals.fileEtags.has(cachekey)) {
            self._headers.etag = JSON.stringify(internals.fileEtags.get(cachekey));
        } else {
            var hash = Crypto.createHash('md5');
            stream.on('data', function (chunk) {
                hash.update(chunk);
            })
            stream.on('end', function () {
                internals.fileEtags.set(cachekey, hash.digest("hex"));
            })
        }
        
        self._headers['Content-Disposition'] = 'inline; filename=' + encodeURIComponent(fileName);

        return Stream.prototype._prepare.call(self, request, callback);
    });
};