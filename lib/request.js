// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Url = require('url');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Request = function (server, req, res) {

    var now = Utils.getTimestamp();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Public members

    this.server = server;
    this.setUrl(req.url);               // Sets: url, path, query
    this.setMethod(req.method);

    // Defined elsewhere:
    //
    // params
    // rawBody
    // payload
    // session: { client, scope, user, tos }
    // reply()

    // Semi-public members

    this.response = {};                // { result, created }
    this.raw = {
        req: req,
        res: res
    };

    // Private members

    this._isResponded = false;
    this._log = [];
    this._analytics = {
        startTime: now
    };

    // Extract session debugging information

    if (this.server.settings.debug) {
        if (this.query[this.server.settings.debug.queryKey]) {
            this._debug = this.query[this.server.settings.debug.queryKey];
        }
    }

    // Log request

    var about = {
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this.log(['http', 'received'], about, now)

    return this;
};

NodeUtil.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype.setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.path = this.url.pathname;
    this.query = this.url.query || {};
};


internals.Request.prototype.setMethod = function (method) {

    this.method = method.toLowerCase();
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Utils.getTimestamp());
    var item = {
        timestamp: now,
        tags: (tags instanceof Array ? tags : [tags])
    };

    if (data) {
        item.data = data;
    }

    // Add to request array
    this._log.push(item);

    // Pass to debug

    if (this._debug) {
        this.server._debugConsole.report(this._debug, item);
    }
};


internals.Request.prototype._respond = function () {

    var code = 200;
    var headers = {};
    var data = null;

    if (this.response.result) {

        if (this.response.result instanceof Error) {
            code = this.response.result.code;
            this.log(['http', 'response', 'error'], this.response.result);
        }
        else {
            if (this.response.created) {
                code = 201;
                headers = { 'Location': this.response.created };
            }

            this.log(['http', 'response']);
        }

        if (typeof this.response.result === 'object') {

            // Object

            headers['Content-Type'] = 'application/json';
            data = (this.response.result instanceof Error ? Err._format(this.response.result) : JSON.stringify(this.response.result));
        }
        else {

            // String

            headers['Content-Type'] = 'text/html';
            data = this.response.result;
        }

        headers['Content-Length'] = Buffer.byteLength(data);
    }
    else {
        this.log(['http', 'response', 'empty']);
    }

    this.raw.res.writeHead(code, headers);
    this.raw.res.end(this.method !== 'head' ? data : '');

    if (!this._isResponded) {
        this.server.emit('response', this);
        this._isResponded = true;
    }
};


exports.processDebug = function (request, config, next) {

    // Extract session debugging information

    if (request.server.settings.debug) {
        if (request.query[request.server.settings.debug.queryKey]) {
            delete request.url.search;
            delete request.query[request.server.settings.debug.queryKey];

            request.raw.req.url = Url.format(request.url);
            request.setUrl(request.raw.req.url);
        }
    }

    next();
};


