
// Load modules

var Url = require('url');
var Http = require('http');
var Https = require('https');
var Stream = require('stream');
var Utils = require('./utils');
var Boom = require('boom');


// Declare internals

var internals = {};


// Create and configure server instance

exports.request = function (method, url, options, callback, _trace) {

    options = options || {};

    Utils.assert(options.payload === null || options.payload === undefined || typeof options.payload === 'string' || options.payload instanceof Stream || Buffer.isBuffer(options.payload), 'options.payload must be either a string, Buffer, or Stream');

    // Setup request

    var uri = Url.parse(url);
    var timeoutId;
    uri.method = method.toUpperCase();
    uri.headers = options.headers;

    if (options.rejectUnauthorized !== undefined && uri.protocol === 'https:') {
        uri.rejectUnauthorized = options.rejectUnauthorized;
    }

    var redirects = (options.hasOwnProperty('redirects') ? options.redirects : false);      // Needed to allow 0 as valid value when passed recursively

    _trace = (_trace || []);
    _trace.push({ method: uri.method, url: url });

    var agent = (uri.protocol === 'https:' ? Https : Http);
    var req = agent.request(uri);

    var shadow = null;                                                                      // A copy of the streamed request payload when redirects are enabled

    // Register handlers

    var isFinished = false;
    var finish = function (err, res) {

        if (!callback || err) {
            if (res) {
                res.destroy();
            }
            
            req.abort();
        }

        if (!isFinished) {
            isFinished = true;

            req.removeAllListeners();
            req.on('error', Utils.ignore);
            clearTimeout(timeoutId);

            if (callback) {
                return callback(err, res);
            }
        }
    };

    req.once('error', function (err) {

        return finish(Boom.badGateway('Client request error', { err: err, trace: _trace }));
    });

    req.once('response', function (res) {

        // Pass-through response

        if (redirects === false ||
            [301, 302, 307, 308].indexOf(res.statusCode) === -1) {

            return finish(null, res);
        }

        // Redirection

        var redirectMethod = (res.statusCode === 301 || res.statusCode === 302 ? 'GET' : uri.method);
        var location = res.headers.location;

        res.destroy();

        if (redirects === 0) {
            return finish(Boom.badGateway('Maximum redirections reached', _trace));
        }

        if (!location) {
            return finish(Boom.badGateway('Received redirection without location', _trace));
        }

        if (!location.match(/^https?:/i)) {
            location = Url.resolve(uri.href, location);
        }

        var redirectOptions = {
            headers: options.headers,
            payload: shadow || options.payload,         // shadow must be ready at this point if set
            redirects: --redirects
        };

        exports.request(redirectMethod, location, redirectOptions, finish, _trace);
    });

    // Write payload

    if (uri.method !== 'GET' &&
        uri.method !== 'HEAD' &&
        options.payload !== null &&
        options.payload !== undefined) {            // Value can be falsey

        if (options.payload instanceof Stream) {
            options.payload.pipe(req);

            if (redirects) {
                var collector = new internals.Collector(function () {

                    shadow = collector.collect();
                });

                options.payload.pipe(collector);
            }

            return;
        }

        req.write(options.payload);
    }

    if (options.timeout) {
        timeoutId = setTimeout(function () {

            return finish(Boom.gatewayTimeout('Client request timeout'));
        }, options.timeout);
    }

    if (options.downstreamRes) {
        options.downstreamRes.once('finish', function () {

            return finish(Boom.internal('Downstream response finished before upstream response finished'));
        });

        options.downstreamRes.once('close', function () {

            return finish(Boom.internal('Downstream response closed before upstream response finished'));
        });
    }

    // Finalize request

    req.end();
};


exports.parse = function (res, callback) {

    var isFinished = false;
    var finish = function (err, buffer) {

        if (!isFinished) {
            isFinished = true;

            writer.removeAllListeners();
            res.removeAllListeners();
            res.on('error', Utils.ignore);

            return callback(err, buffer);
        }
    };

    res.once('error', function (err) {

        return finish(Boom.internal('Upstream response error', err));
    });

    res.once('close', function () {

        return finish(Boom.internal('Upstream response closed prematurely'));
    });

    var writer = new internals.Collector(function () {

        return finish(null, writer.collect());
    });

    res.pipe(writer);
};


internals.Collector = function (options, callback) {

    if (!callback) {
        callback = options;
        options = {};
    }

    Stream.Writable.call(this);
    this.buffers = [];
    this.length = 0;

    this.once('finish', callback);
};

Utils.inherits(internals.Collector, Stream.Writable);


internals.Collector.prototype._write = function (chunk, encoding, next) {

    this.length += chunk.length;
    this.buffers.push(chunk);
    next();
};


internals.Collector.prototype.collect = function () {

    var buffer = (this.buffers.length === 0 ? new Buffer(0) : (this.buffers.length === 1 ? this.buffers[0] : Buffer.concat(this.buffers, this.length)));
    return buffer;
};


exports.parseCacheControl = function (field) {

    /*
        Cache-Control   = 1#cache-directive
        cache-directive = token [ "=" ( token / quoted-string ) ]
        token           = [^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+
        quoted-string   = "(?:[^"\\]|\\.)*"
    */

    //           1: directive                                                      =       2: token                                              3: quoted-string
    var regex = /(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g;

    var header = {};
    var err = field.replace(regex, function ($0, $1, $2, $3) {

        var value = $2 || $3;
        header[$1] = value ? value.toLowerCase() : true;
        return '';
    });

    if (header['max-age']) {
        try {
            var maxAge = parseInt(header['max-age'], 10);
            if (isNaN(maxAge)) {
                return null;
            }

            header['max-age'] = maxAge;
        }
        catch(err) {}
    }

    return (err ? null : header);
};
