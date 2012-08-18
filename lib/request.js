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

    // Confirm that Request is called as constructor

    if (this.constructor != Request) {

        Utils.abort('Request must be instantiated using new');
    }

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Member variables

    this.raw = {

        req: req,
        res: res
    };

    this.server = server;

    // Process request

    this.method = req.method.toLowerCase();
    this.url = Url.parse(req.url, true);
    this.path = this.url.pathname;
    this.query = this.url.query || {};

    // Old crap

    res.hapi = {};
    req._startTime = new Date; // Used to determine request response time 
    Log.info('Received', req);

    return this;
};

NodeUtil.inherits(Request, Events.EventEmitter);


