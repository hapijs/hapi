// Load modules

var Domain = require('domain');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Protect = function (request) {

    var self = this;

    this._error = null;
    this.logger = request;                          // Replaced with server when request completes

    this.domain = Domain.create();
    this.domain.on('error', function (err) {

        var handler = self._error;
        if (handler) {
            self._error = null;
            return handler(err);
        }

        self.logger.log(['hapi', 'internal', 'implementation', 'error'], err);
    });
};


internals.Protect.prototype.run = function (next, enter) {          // enter: function (exit)

    var self = this;

    Utils.assert(!this._error, 'Invalid nested use of protect.run()');

    var finish = function (/* arguments */) {

        self._error = null;
        return next.apply(null, arguments);
    };

    finish = Utils.once(finish);

    this._error = function (err) {

        return finish(Boom.badImplementation('Uncaught error', err));
    };

    enter(finish);
};
