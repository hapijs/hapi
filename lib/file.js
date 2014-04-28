// Load modules

var Fs = require('fs');
var Path = require('path');
var Crypto = require('crypto');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('./utils');
var Response = require('./response');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports.handler = function (route, options) {

    Schema.assert('file handler', options, route.path);
    var settings = (typeof options !== 'object' ? { path: options } : Utils.clone(options));                        // options can be reused
    Utils.assert(typeof settings.path !== 'string' || settings.path[settings.path.length - 1] !== '/', 'File path cannot end with a \'/\':', route.path);

    var handler = function (request, reply) {

        var path = (typeof settings.path === 'function' ? settings.path(request) : settings.path);
        return reply.file(path, settings);
    };

    return handler;
};


exports.load = function (path, request, callback) {

    var response = new internals.Response(path, {}, request);
    return response._prepare(request, callback);
};


exports.Response = internals.Response = function (path, options, request) {

    options = options || {};
    Utils.assert(!options.mode || ['attachment', 'inline'].indexOf(options.mode) !== -1, 'options.mode must be either false, attachment, or inline');

    var relativeTo = (request._route.env.path || request.server.settings.files.relativeTo);

    var source = {
        path: Path.normalize(Utils.isAbsolutePath(path) ? path : Path.join(relativeTo, path)),
        settings: options,
        stat: null
    };

    Response.Plain.call(this, source, request, 'file');
};

Utils.inherits(internals.Response, Response.Plain);


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

        self.source.stat = stat;

        self.bytes(stat.size);
        self.type(Mime.lookup(path));
        self._header('last-modified', stat.mtime);

        if (request.server._etags) {

            // Use stat info for an LRU cache key.

            var cachekey = [path, stat.ino, stat.size, stat.mtime.getTime()].join('-');

            // The etag must hash the file contents in order to be consistent across distributed deployments

            var cachedEtag = request.server._etags.get(cachekey);
            if (cachedEtag) {
                self._header('etag', '"' + cachedEtag + '"');
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

    // Prepare Stream response

    var path = this.source.path;
    var fileStream = Fs.createReadStream(path);
    fileStream.once('error', callback);
    fileStream.once('open', function () {

        fileStream.removeListener('error', callback);

        self._payload = fileStream;

        if (!self.source.settings.lookupCompressed) {
            return callback();
        }

        var gzFile = path + '.gz';
        Fs.stat(gzFile, function (err, stat) {

            if (!err &&
                !stat.isDirectory()) {

                var gzipped = Fs.createReadStream(gzFile);
                fileStream._hapi = { gzipped: gzipped };
            }

            return callback();
        });
    });
};
