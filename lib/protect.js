// Load modules

var Domain = require('domain');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Protect = function (parent) {

    var self = this;

    this._parent = parent;
    this._error = null;


    this._baseDomain = Domain.createDomain();                       // Envelope domain to force exit all nested inner domains

    this.domain = Domain.createDomain();
    this.domain.on('error', function (err) {

        var handler = self._error;
        if (handler) {
            self._error = null;
            return handler(err);
        }

        self._parent.log(['hapi', 'internal', 'implementation', 'error'], err);
    });
};


internals.Protect.prototype.run = function (next, setup) {          // setup: function (enter, exit)

    var self = this;

    Utils.assert(!this._error, 'Invalid nested use of protect.run()');

    var finish = function (/* arguments */) {

        self._baseDomain.exit();                                    // Forces exit from this.domain along with any nested domains
        self._error = null;

        return next.apply(null, arguments);
    };

    finish = Utils.once(finish);

    this._error = function (err) {

        return finish(Boom.badImplementation('Uncaught error', err));
    };

    var protect = function (run) {

        self._baseDomain.enter();
        self.domain.enter();
        run();
    };

    setup(protect, finish);
};
