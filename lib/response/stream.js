// Load modules

var NodeUtil = require('util');
var Stream = require('stream');
var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Stream response (Base -> Generic -> Stream)

exports = module.exports = internals.Stream = function (stream) {

    Generic.call(this);
    this._tag = 'stream';
    delete this._payload;

    this.stream = stream;

    return this;
};

NodeUtil.inherits(internals.Stream, Generic);


internals.Stream.prototype._transmit = function (request, callback) {

    var self = this;

    // Check if stream is a node HTTP response (stream.*) or a (mikeal's) Request object (stream.response.*)

    if (!request._route ||
        !request._route.config.proxy ||
        request._route.config.proxy.passThrough) {     // Pass headers only if not proxy or proxy with pass-through set

        var responseHeaders = this.stream.response ? this.stream.response.headers : this.stream.headers;
        if (responseHeaders) {
            Utils.merge(this.headers, responseHeaders);
        }
    }

    this._code = this.stream.statusCode || ((this.stream.response && this.stream.response.code) ? this.stream.response.code : this._code);

    request.raw.res.writeHead(this._code, this.headers);

    var isEnded = false;
    var end = function () {

        if (isEnded) {
            return;
        }

        isEnded = true;
        request.raw.res.end();
        callback();
    };

    request.raw.req.on('close', function () {

        self.stream.destroy.bind(self.stream);
        end();
    });

    this.stream.on('error', function () {

        request.raw.req.destroy();
        end();
    });

    this.stream.on('end', function () {

        end();
    });

    this.stream.resume();
    this.stream.pipe(request.raw.res);
};


