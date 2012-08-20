/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Url = require('url');
var Utils = require('./utils');
var Log = require('./log');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = Request = function (server, req, res) {

    var now = new Date();

    // Confirm that Request is called as constructor

    if (this.constructor != Request) {

        Utils.abort('Request must be instantiated using new');
    }

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

    // Private members

    this._raw = {

        req: req,
        res: res
    };

    this._response = {};
    this._analytics = {

        startTime: now
    };

    // Defined elsewhere:
    //
    // _response: { result, error, options }

    Log.info('Received', this);
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

