// Load modules

var Fs = require('fs');
var Path = require('path');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('../utils');
var Stream = require('./stream');
var LruCache = require('lru-cache');
var Crypto = require('crypto');


// Declare internals

var internals = {
    fileEtags: LruCache()           // Files etags cache
};


// File response  (Base -> Generic -> Stream -> File)

exports = module.exports = internals.File = function (filePath) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');

    Stream.call(this, null);
    this.variety = 'file';
    this.varieties.file = true;

    this._filePath = Path.normalize(filePath);

    return this;
};

Utils.inherits(internals.File, Stream);


internals.File.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

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
        self._headers['Last-Modified'] = stat.mtime;

        // Use stat info for an LRU cache key.

        var cachekey = [self._filePath, stat.ino, stat.size, stat.mtime.getTime()].join('-');

        // The etag must hash the file contents in order to be consistent across distributed deployments

        if (internals.fileEtags.has(cachekey)) {
            self._headers.etag = JSON.stringify(internals.fileEtags.get(cachekey));
        }
        else {
            var hash = Crypto.createHash('sha1');
            stream.on('data', function (chunk) {

                hash.update(chunk);
            });

            stream.on('end', function () {

                var etag = hash.digest('hex');
                internals.fileEtags.set(cachekey, etag);
            });
        }

        self._headers['Content-Disposition'] = 'inline; filename=' + encodeURIComponent(fileName);

        return Stream.prototype._prepare.call(self, request, callback);
    });
};