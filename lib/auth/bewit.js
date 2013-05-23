// Load modules

var Hawk = require('hawk');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'bewit', 'Wrong scheme');
    Utils.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);
    this.settings.hawk = this.settings.hawk || {};
    if (this.settings.hostHeaderName) {
        this.settings.hawk.hostHeaderName = this.settings.hostHeaderName;       // For backwards compatiblity
    }
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    Hawk.server.authenticateBewit(request.raw.req, this.settings.getCredentialsFunc, this.settings.hawk, function (err, credentials, bewit) {

        return callback(err, credentials, { artifacts: bewit });
    });
};