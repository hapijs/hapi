// Load modules

var Oz = require('oz');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'oz', 'Wrong scheme');
    Utils.assert(options.encryptionPassword, 'Missing encryption password');
    Utils.assert(options.loadAppFunc, 'Missing required loadAppFunc method in configuration');
    Utils.assert(options.loadGrantFunc, 'Missing required loadGrantFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused
    this.settings.appEndpoint = this.settings.appEndpoint || '/oz/app';
    this.settings.reissueEndpoint = this.settings.reissueEndpoint || '/oz/reissue';
    this.settings.rsvpEndpoint = this.settings.rsvpEndpoint || '/oz/rsvp';
    this.settings.isHttps = !!server.settings.tls;

    // Setup Oz environment

    if (this.settings.ozSettings) {
        Oz.settings.set(this.settings.ozSettings);
    }

    // Add protocol endpoints

    server.route([
        { method: 'POST', path: this.settings.appEndpoint, config: this._endpoint('app') },
        { method: 'POST', path: this.settings.reissueEndpoint, config: this._endpoint('reissue') },
        { method: 'POST', path: this.settings.rsvpEndpoint, config: this._endpoint('rsvp') }
    ]);

    return this;
};


// Request an application ticket using Basic authentication

internals.Scheme.prototype._endpoint = function (name) {

    var self = this;

    var endpoint = {
        auth: {
            mode: 'none'
        },
        handler: function (request) {

            Oz.endpoints[name](request.raw.req, request.payload, self.settings, function (err, response) {

                return request.reply(err || response);
            });
        }
    };

    return endpoint;
};


// Token Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    Oz.request.authenticate(request.raw.req, this.settings.encryptionPassword, { isHttps: this.settings.isHttps }, function (err, ticket, ext) {

        if (ticket) {
            ticket.authExt = ext;
        }

        return callback(err, ticket);
    });
};


