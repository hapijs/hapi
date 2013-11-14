// Load modules

var Fs = require('fs');
var Path = require('path');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('../utils');
var StreamResponse = require('./stream');
var LruCache = require('lru-cache');
var Crypto = require('crypto');


// Declare internals

var internals = {
    fileEtags: LruCache()           // Files etags cache
};


// File response  (Generic -> Stream -> File)

exports = module.exports = internals.File = function (filePath, options) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');
    Utils.assert(!options || !options.mode || ['attachment', 'inline'].indexOf(options.mode) !== -1, 'options.mode must be either false, attachment, or inline');

    StreamResponse.call(this, null);
    this.variety = 'file';
    this.varieties.file = true;

    this._filePath = Path.normalize(filePath);
    this._mode = options ? options.mode : false;
    this._lookupCompressed = options ? options.lookupCompressed : false;
};

Utils.inherits(internals.File, StreamResponse);


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

        self._headers['content-type'] = Mime.lookup(self._filePath) || 'application/octet-stream';
        self._headers['content-length'] = stat.size;
        self._headers['last-modified'] = stat.mtime;

        // Use stat info for an LRU cache key.

        var cachekey = [self._filePath, stat.ino, stat.size, stat.mtime.getTime()].join('-');

        // The etag must hash the file contents in order to be consistent across distributed deployments

        if (internals.fileEtags.has(cachekey)) {
            self._headers.etag = JSON.stringify(internals.fileEtags.get(cachekey));
        }
        else {
            var hash = Crypto.createHash('sha1');
            self._preview.on('peek', function (chunk) {

                hash.update(chunk);
            });

            self._preview.once('finish', function () {

                var etag = hash.digest('hex');
                internals.fileEtags.set(cachekey, etag);
            });
        }

        if (self._mode) {
            self._headers['content-disposition'] = self._mode + '; filename=' + encodeURIComponent(fileName);
        }

        return StreamResponse.prototype._prepare.call(self, request, callback);
    });
};


internals.File.prototype._transmit = function (request, callback) {

    var self = this;

    if (this._lookupCompressed) {
        var gzFile = self._filePath + '.gz';
        Fs.stat(gzFile, function (err, stat) {

            if (err || stat.isDirectory()) {
                return self._transmitNext(request, null, callback);
            }

            return self._transmitNext(request, Fs.createReadStream(gzFile), callback);
        });
    }
    else {
        return this._transmitNext(request, null, callback);
    }
};


internals.File.prototype._transmitNext = function (request, gzipped, callback) {

    this._setStream(Fs.createReadStream(this._filePath), gzipped);
    return StreamResponse.prototype._transmit.call(this, request, callback);
};

