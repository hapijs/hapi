/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Url = require('url');
var Utils = require('./utils');
var Debug = require('./debug');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = Request = function (server, req, res) {

    var now = new Date();

    Utils.assert(this.constructor === Request, 'Request must be instantiated using new');

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
    // session: { client, scope, user }
    // clientId
    // scope
    // userId
    // reply()

    // Semi-public members

    this.response = {};                // { result, error, options }
    this.raw = {

        req: req,
        res: res
    };

    // Private members

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

    this.log('http', 'received', about, now)

    return this;
};

NodeUtil.inherits(Request, Events.EventEmitter);


Request.prototype.setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.path = this.url.pathname;
    this.query = this.url.query || {};
};


Request.prototype.setMethod = function (method) {

    this.method = method.toLowerCase();
};


Request.prototype.log = function (category, event, data, timestamp) {

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Utils.getTimestamp());
    var item = {

        timestamp: now,
        category: category,
        event: event
    };
    
    if (data) {

        item.data = data;
    }

    // Add to array

    this._log.push(item);

    // Pass to debug

    if (this._debug) {

        Debug.report(this._debug, item);
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


