// Load modules

var NodeUtil = require('util');
var Http = require('http');


// Declare internals

var internals = {};


exports._Request = internals.Request = function (options) {

    // options: method, url, payload, agent

    this.url = options.url;
    this.method = options.method.toUpperCase();
    this.headers = {
        'user-agent': options.agent || 'hapi-injection'
    };

    this._payload = options.payload;
    return this;
};


internals.Response = function (req, onEnd) {

    Http.ServerResponse.call(this, { method: req.method, httpVersionMajor: 1, httpVersionMinor: 1 });

    this._hapi = {
        req: req,
        onEnd: onEnd
    };

    return this;
};

NodeUtil.inherits(internals.Response, Http.ServerResponse);


internals.Response.prototype.end = function (data, encoding) {

    Http.ServerResponse.prototype.end.call(this, data, encoding);
    this.emit('finish');
    this._hapi.onEnd(this);
};


exports.inject = function (server, options, callback) {

    var req = new internals.Request(options);
    var res = new internals.Response(req, callback);
    var needle = server._dispatch();
    needle(req, res);
};

