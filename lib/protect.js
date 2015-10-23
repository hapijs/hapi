'use strict';

// Load modules

let Domain = null;                                  // Loaded as needed
const Boom = require('boom');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports = module.exports = internals.Protect = function (request) {

    const self = this;

    this._error = null;
    this.logger = request;                          // Replaced with server when request completes

    if (!request.server.settings.useDomains) {
        this.domain = null;
        return;
    }

    Domain = Domain || require('domain');

    this.domain = Domain.create();
    this.domain.on('error', function (err) {

        return self._onError(err);
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

    const self = this;

    const finish = Hoek.once(function (arg0, arg1, arg2) {

        self._error = null;
        return next(arg0, arg1, arg2);
    });

    if (!this.domain) {
        return enter(finish);
    }

    this._error = function (err) {

        return finish(Boom.badImplementation('Uncaught error', err));
    };

    enter(finish);
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
