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

exports.request = function (method, url, options, callback) {

    var uri = Url.parse(url);
    uri.method = method.toUpperCase();
    uri.headers = options.headers;

    var agent = (uri.protocol === 'https:' ? Https : Http);
    var req = agent.request(uri);

    var isFinished = false;
    var finish = function (err, res) {

        if (!isFinished) {
            isFinished = true;

            req.removeAllListeners();

            return callback(err, res);
        }
    };

    req.once('error', finish);

    req.once('response', function (res) {

        // res.statusCode
        // res.headers
        // res Readable stream

        return finish(null, res);
    });

    if (uri.method !== 'GET' &&
        uri.method !== 'HEAD' &&
        options.payload !== null &&
        options.payload !== undefined) {            // Value can be falsey

        if (options.payload instanceof Stream) {
            options.payload.pipe(req);
            return;
        }

        req.write(options.payload);
    }

    req.end();
};


exports.parse = function (res, callback) {

    var Writer = function () {

        Stream.Writable.call(this);
        this.buffers = [];
        this.length = 0;

        return this;
    };

    Utils.inherits(Writer, Stream.Writable);

    Writer.prototype._write = function (chunk, encoding, next) {

        this.legnth += chunk.length;
        this.buffers.push(chunk);
        next();
    };

    var isFinished = false;
    var finish = function (err, buffer) {

        if (!isFinished) {
            isFinished = true;

            writer.removeAllListeners();
            res.removeAllListeners();

            return callback(err || (buffer ? null : Boom.internal('Client request closed')), buffer);
        }
    };

    var writer = new Writer();
    writer.once('finish', function () {

        return finish(null, Buffer.concat(writer.buffers, writer.length));
    });

    res.once('error', finish);
    res.once('close', finish);

    res.pipe(writer);
};
