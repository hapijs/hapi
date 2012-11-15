// Load modules

var Stream = require('stream');
var NodeUtil = require('util');
var Shot = require('shot');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Base response

exports.Base = internals.Base = function () {

    this.code = 200;
    this.headers = {};
    this.payload = null;
    this.options = {};
    this._tag = 'generic';

    return this;
};


internals.Base.prototype._transmit = function (request, callback) {

    request.raw.res.writeHead(this.code, this.headers);
    request.raw.res.end(request.method !== 'head' ? this.payload : '');

    return callback();
};


internals.Base.prototype.header = function (key, value) {

    this.headers[key] = value;
    return this;
};


internals.Base.prototype.type = function (type) {

    this.headers['Content-Type'] = type;
    return this;
};


internals.Base.prototype.bytes = function (bytes) {

    this.headers['Content-Length'] = bytes;
    return this;
};


internals.Base.prototype.created = function (uri) {

    this.code = 201;
    this.headers['Location'] = uri;
    return this;
};


internals.Base.prototype.ttl = function (ttlMsec, isOverride) {      // isOverride defaults to true

    this.ttlMsec = (isOverride === false ? (this.ttlMsec ? this.ttlMsec : ttlMsec) : ttlMsec);
    return this;
};


// Empty response

exports.Empty = internals.Empty = function () {

    internals.Base.call(this);
    this._tag = 'empty';

    this.payload = '';
    this.headers['Content-Length'] = 0;

    return this;
};

NodeUtil.inherits(internals.Empty, internals.Base);


// Obj response

exports.Obj = internals.Obj = function (object, type) {

    internals.Base.call(this);
    this._tag = 'obj';

    this.payload = JSON.stringify(object);                              // Convert immediately to snapshot content
    this.raw = object;                                                  // Can change is reference is modified
    this.headers['Content-Type'] = type || 'application/json';
    this.headers['Content-Length'] = Buffer.byteLength(this.payload);

    return this;
};

NodeUtil.inherits(internals.Obj, internals.Base);


// Text response

exports.Text = internals.Text = function (text, type) {

    internals.Base.call(this);
    this._tag = 'text';

    this.payload = text;
    this.headers['Content-Type'] =  type || 'text/html';
    this.headers['Content-Length'] = Buffer.byteLength(this.payload);

    return this;
};

NodeUtil.inherits(internals.Text, internals.Base);


// Stream response

exports.Stream = internals.Stream = function (stream) {

    internals.Base.call(this);
    this._tag = 'stream';
    delete this.payload;

    this.stream = stream;

    return this;
};

NodeUtil.inherits(internals.Stream, internals.Base);


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

    this.code = this.stream.statusCode || ((this.stream.response && this.stream.response.code) ? this.stream.response.code : this.code);

    request.raw.res.writeHead(this.code, this.headers);

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


// Error response

internals.Error = function (options) {

    // { code, payload, type, headers }

    internals.Obj.call(this, options.payload);
    this._tag = 'error';
    this.code = options.code;

    Utils.merge(this.headers, options.headers);
    if (options.type) {
        this.headers['Content-Type'] = options.type;
    }

    return this;
};

NodeUtil.inherits(internals.Error, internals.Obj);


// Utilities

exports.generateResponse = function (result, onSend) {

    var response = null;

    if (result === null ||
        result === undefined ||
        result === '') {

        response = new internals.Empty();
    }
    else if (typeof result === 'string') {
        response = new internals.Text(result);
    }
    else if (typeof result === 'object') {
        if (result instanceof Err) {
            response = result;
        }
        else if (result instanceof Error) {
            response = new Err(result);
        }
        else if (result instanceof Stream) {
            response = new internals.Stream(result);
        }
        else if (result instanceof internals.Base) {
            response = result;
        }
    }

    if (!response) {
        response = new internals.Obj(result);
    }

    Utils.assert(response && (response instanceof internals.Base || response instanceof Error), 'Response must be an instance of Error or Base');   // Safety

    if (onSend) {
        response.send = function () {

            delete response.send;
            onSend();
        };
    }

    return response;
};


exports._respond = function (response, request, callback) {

    if (!response ||
        (!(response instanceof internals.Base) && !(response instanceof Err))) {

        response = Err.internal('Unexpected response object', response);
    }

    // Error object

    if (response instanceof Err) {

        var errOptions = (request.server.settings.errors && request.server.settings.errors.format
                                ? request.server.settings.errors.format(response)
                                : response.toResponse());

        request.log(['http', 'response', 'error'], response);
        response = new internals.Error(errOptions);
    }

    // Normalize Location header

    if (response.headers.Location) {
        var uri = response.headers.Location;
        var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
        response.headers.Location = (isAbsolute ? uri : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
    }

    // Caching headers

    response.header('Cache-Control',response.ttlMsec ? 'max-age=' + Math.floor(response.ttlMsec / 1000) : 'must-revalidate');

    // CORS headers

    if (request.server.settings.cors &&
        (!request._route || request._route.config.cors !== false)) {

        response.header('Access-Control-Allow-Origin', request.server.settings.cors._origin);
        response.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
        response.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
        response.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);
    }

    // Injection

    if (response.payload !== undefined) {                           // Value can be falsey
        if (Shot.isInjection(request.raw.req)) {
            request.raw.res.hapi = { result: response.raw || response.payload };
        }
    }

    // Response object

    response._transmit(request, function () {

        request.log(['http', 'response', response._tag]);
        return callback();
    });
};





