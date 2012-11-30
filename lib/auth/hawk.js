// Load modules

var Hawk = require('hawk');
var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'hawk', 'Wrong scheme');
    Utils.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);
    this.settings.hostHeaderName = this.settings.hostHeaderName || 'host';

    return this;
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    Hawk.authenticate(request.raw.req, this.settings.getCredentialsFunc, { hostHeaderName: this.settings.hostHeaderName }, function (err, credentials, ext) {

        if (credentials) {
            credentials.authExt = ext;
        }

        return callback(err, credentials);
    });
};
