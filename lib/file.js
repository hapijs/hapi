// Load modules

var Fs = require('fs');
var Path = require('path');
var Crypto = require('crypto');
var Boom = require('boom');
var Hoek = require('hoek');
var Mimos = require('mimos');
var Response = require('./response');
var Schema = require('./schema');


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

    var response = exports.response(path, options, request);
    return internals.prepare(response, callback);
};


exports.response = function (path, options, request) {

    options = options || {};
    Hoek.assert(!options.mode || ['attachment', 'inline'].indexOf(options.mode) !== -1, 'options.mode must be either false, attachment, or inline');

    var relativeTo = (request._route._env.path || request.server.settings.files.relativeTo);

    var source = {
        path: Path.normalize(Hoek.isAbsolutePath(path) ? path : Path.join(relativeTo, path)),
        settings: options,
        stat: null
    };

    return new Response.Message(source, request, { variety: 'file', marshall: internals.marshall, prepare: internals.prepare });
};


internals.prepare = function (response, callback) {

    var path = response.source.path;
    Fs.stat(path, function (err, stat) {

        if (err) {
            return callback(Boom.notFound());
        }

        if (stat.isDirectory()) {
            return callback(Boom.forbidden());
        }

        response.bytes(stat.size);

        if (!response.headers['content-type']) {
            response.type(Mimos.path(path).type || 'application/octet-stream');
        }

        response._header('last-modified', stat.mtime.toUTCString());

        if (response.request.server._etags) {

            // Use stat info for an LRU cache key.

            var cachekey = [path, stat.ino, stat.size, stat.mtime.getTime()].join('-');

            // The etag must hash the file contents in order to be consistent across distributed deployments

            var cachedEtag = response.request.server._etags.get(cachekey);
            if (cachedEtag) {
                response.etag(cachedEtag, { vary: true });
            }
            else {
                var hash = Crypto.createHash('sha1');
                response.on('peek', function (chunk) {

                    hash.update(chunk);
                });

                response.once('finish', function () {

                    var etag = hash.digest('hex');
                    response.request.server._etags.set(cachekey, etag);
                });
            }
        }

        if (response.source.settings.mode) {
            var fileName = response.source.settings.filename || Path.basename(path);
            response._header('content-disposition', response.source.settings.mode + '; filename=' + encodeURIComponent(fileName));
        }

        return callback(response);
    });
};


internals.marshall = function (response, callback) {

    if (!response.source.settings.lookupCompressed ||
        response.request.info.acceptEncoding !== 'gzip') {

        return internals.openStream(response, response.source.path, callback);
    }

    var gzFile = response.source.path + '.gz';
    Fs.stat(gzFile, function (err, stat) {

        if (err ||
            stat.isDirectory()) {

            return internals.openStream(response, response.source.path, callback);
        }

        response.bytes(stat.size);
        response._header('content-encoding', 'gzip');
        response.vary('accept-encoding');

        return internals.openStream(response, gzFile, callback);
    });
};


internals.openStream = function (response, path, callback) {

    var fileStream = Fs.createReadStream(path);

    var onError = function (err) {

        fileStream.removeListener('open', onOpen);
        return callback(err);
    };

    var onOpen = function () {

        fileStream.removeListener('error', onError);
        return callback(null, fileStream);
    };

    fileStream.once('error', onError);
    fileStream.once('open', onOpen);
};