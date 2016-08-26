'use strict';

// Load modules

let Domain = null;                                  // Loaded as needed
const Boom = require('boom');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports = module.exports = internals.Protect = function (request) {

    this._error = null;
    this.logger = request;                          // Replaced with server when request completes

    if (!request.server.settings.useDomains) {
        this.domain = null;
        return;
    }

    Domain = Domain || require('domain');

    this.domain = Domain.create();
    this.domain.on('error', (err) => {

        return this._onError(err);
    });
};


internals.Protect.prototype._onError = function (err) {

    const handler = this._error;
    if (handler) {
        this._error = null;
        return handler(err);
    }

    this.logger._log(['internal', 'implementation', 'error'], err);
};


internals.Protect.prototype.run = function (next, enter) {              // enter: function (exit)

    const finish = Hoek.once((arg0, arg1, arg2) => {

        this._error = null;
        return next(arg0, arg1, arg2);
    });

    if (this.domain) {
        this._error = (err) => {

            return finish(Boom.badImplementation('Uncaught error', err));
        };
    }

    return enter(finish);
};


internals.Protect.prototype.reset = function () {

    this._error = null;
};


internals.Protect.prototype.enter = function (func) {

    if (!this.domain) {
        return func();
    }

    this.domain.run(func);
};
