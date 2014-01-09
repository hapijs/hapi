// Load modules

var Fs = require('fs');
var Path = require('path');
var Crypto = require('crypto');
var Mime = require('mime');
var Boom = require('boom');
var Utils = require('./utils');
var Response = require('./response');


// Declare internals

var internals = {};


exports.handler = function (route, options) {

    var settings = (typeof options !== 'object' ? { path: options } : Utils.clone(options));                        // options can be reused
    Utils.assert(typeof settings.path !== 'string' || settings.path[settings.path.length - 1] !== '/', 'File path cannot end with a \'/\':', route.path);

    var relativeTo = (route.env.path || route.server.settings.files.relativeTo);

    // Normalize static string path

    if (typeof settings.path === 'string') {
        var staticPath = settings.path;
        if (staticPath[0] !== '/') {
            staticPath = Path.join(relativeTo, staticPath);
        }
    }

    var handler = function (request, reply) {

        var path = null;

        if (typeof settings.path === 'function') {
            path = settings.path(request);

            // Normalize function string path

            if (path[0] !== '/') {
                path = Path.join(relativeTo, path);
            }
        }
        else {
            path = staticPath;
        }

        return reply.file(path, settings);
    };

    return handler;
};


exports.Response = internals.Response = function (path, settings, request) {

    var relativeTo = (request._route.env.path || request.server.settings.files.relativeTo);

    var source = {
        path: (path[0] === '/' ? path : Path.join(relativeTo, path)),
        settings: settings
    };

    Response.Plain.call(this, source, request, 'file');
};

Utils.inherits(internals.Response, Response.Plain);


internals.Response.prototype._marshall = function (request, callback) {

    return exports.load(this.source.path, this.source.settings, this, request, callback);      // Ignoring callback second argument
};


exports.load = function (path, options, response, request, callback) {

    options = options || {};
    Utils.assert(!options.mode || ['attachment', 'inline'].indexOf(options.mode) !== -1, 'options.mode must be either false, attachment, or inline');

    var filePath = Path.normalize(path);
    Fs.stat(filePath, function (err, stat) {

        if (err) {
            return callback(Boom.notFound());
        }

        if (stat.isDirectory()) {
            return callback(Boom.forbidden());
        }

        // Prepare Stream response

        var fileStream = Fs.createReadStream(filePath);
        response = response || new internals.Response(path, options, request);
        response._payload = fileStream;

        response.bytes(stat.size);
        response.type(Mime.lookup(filePath) || 'application/octet-stream');
        response._header('last-modified', stat.mtime);

        if (request.server._etags) {

            // Use stat info for an LRU cache key.

            var cachekey = [filePath, stat.ino, stat.size, stat.mtime.getTime()].join('-');

            // The etag must hash the file contents in order to be consistent across distributed deployments

            var cachedEtag = request.server._etags.get(cachekey);
            if (cachedEtag) {
                response._header('etag', cachedEtag);
            }
            else {
                var hash = Crypto.createHash('sha1');
                response.on('peek', function (chunk) {

                    hash.update(chunk);
                });

                response.once('finish', function () {

                    var etag = hash.digest('hex');
                    request.server._etags.set(cachekey, etag);
                });
            }
        }

        if (options.mode) {
            var fileName = Path.basename(filePath);
            response._header('content-disposition', options.mode + '; filename=' + encodeURIComponent(fileName));
        }

        if (!options.lookupCompressed) {
            return callback(null, response);
        }

        var gzFile = filePath + '.gz';
        Fs.stat(gzFile, function (err, stat) {

            if (!err &&
                !stat.isDirectory()) {

                fileStream._hapi = { gzipped: Fs.createReadStream(gzFile) };
            }

            return callback(null, response);
        });
    });
};
