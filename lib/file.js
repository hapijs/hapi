// Load modules

var Fs = require('fs');
var Path = require('path');
var Crypto = require('crypto');
var Boom = require('boom');
var Hoek = require('hoek');
var Response = require('./response');
var Schema = require('./schema');
var Mime = require('./mime');


// Declare internals

var internals = {};


exports.handler = function (route, options) {

    Schema.assert('file handler', options, route.path);
    var settings = (typeof options !== 'object' ? { path: options } : Hoek.clone(options));                        // options can be reused
    Hoek.assert(typeof settings.path !== 'string' || settings.path[settings.path.length - 1] !== '/', 'File path cannot end with a \'/\':', route.path);

    var handler = function (request, reply) {

        var path = (typeof settings.path === 'function' ? settings.path(request) : settings.path);
        return reply.file(path, settings);
    };

    return handler;
};


exports.load = function (path, request, options, callback) {

    var response = new internals.Response(path, options, request);
    return response._prepare(request, callback);
};


exports.Response = internals.Response = function (path, options, request) {

    options = options || {};
    Hoek.assert(!options.mode || ['attachment', 'inline'].indexOf(options.mode) !== -1, 'options.mode must be either false, attachment, or inline');

    var relativeTo = (request._route._env.path || request.server.settings.files.relativeTo);

    var source = {
        path: Path.normalize(Hoek.isAbsolutePath(path) ? path : Path.join(relativeTo, path)),
        settings: options,
        stat: null
    };

    Response.Plain.call(this, source, request, 'file');
};

Hoek.inherits(internals.Response, Response.Plain);


internals.Response.prototype._prepare = function (request, callback) {

    var self = this;

    var path = this.source.path;
    Fs.stat(path, function (err, stat) {

        if (err) {
            return callback(Boom.notFound());
        }

        if (stat.isDirectory()) {
            return callback(Boom.forbidden());
        }

        self.bytes(stat.size);
        self.type(Mime.path(path).type || 'application/octet-stream');
        self._header('last-modified', stat.mtime.toString());

        if (request.server._etags) {

            // Use stat info for an LRU cache key.

            var cachekey = [path, stat.ino, stat.size, stat.mtime.getTime()].join('-');

            // The etag must hash the file contents in order to be consistent across distributed deployments

            var cachedEtag = request.server._etags.get(cachekey);
            if (cachedEtag) {
                self.etag(cachedEtag, { vary: true });
            }
            else {
                var hash = Crypto.createHash('sha1');
                self.on('peek', function (chunk) {

                    hash.update(chunk);
                });

                self.once('finish', function () {

                    var etag = hash.digest('hex');
                    request.server._etags.set(cachekey, etag);
                });
            }
        }

        if (self.source.settings.mode) {
            var fileName = self.source.settings.filename || Path.basename(path);
            self._header('content-disposition', self.source.settings.mode + '; filename=' + encodeURIComponent(fileName));
        }

        return callback(self);
    });
};


internals.Response.prototype._marshall = function (request, callback) {

    var self = this;

    if (!this.source.settings.lookupCompressed ||
        request.info.acceptEncoding !== 'gzip') {

        return this._openStream(this.source.path, callback);
    }

    var gzFile = this.source.path + '.gz';
    Fs.stat(gzFile, function (err, stat) {

        if (err ||
            stat.isDirectory()) {

            return self._openStream(self.source.path, callback);
        }

        self.bytes(stat.size);
        self._header('content-encoding', 'gzip');
        self.vary('accept-encoding');

        return self._openStream(gzFile, callback);
    });
};


internals.Response.prototype._openStream = function (path, callback) {

    var self = this;

    var fileStream = Fs.createReadStream(path);

    var onError = function (err) {

        fileStream.removeListener('open', onOpen);
        return callback(err);
    };

    var onOpen = function () {

        fileStream.removeListener('error', onError);

        self._payload = fileStream;
        return callback();
    };

    fileStream.once('error', onError);
    fileStream.once('open', onOpen);
};