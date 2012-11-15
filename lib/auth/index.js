// Load modules

var Oz = require('./oz');
var Basic = require('./basic');
var Utils = require('../utils');
var Err = require('../error');
var Log = require('../log');


// Declare internals

var internals = {};


exports = module.exports = internals.Auth = function (server, options) {

    Utils.assert(this.constructor === internals.Auth, 'Auth must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme, 'Missing scheme');

    // Built-in schemes

    if (options.scheme === 'oz') {
        this.scheme = new Oz.Scheme(server, options);
    }
    else if (options.scheme === 'basic') {
        this.scheme = new Basic.Scheme(server, options);
    }
    else {

        // Extension scheme

        Utils.assert(options.scheme.indexOf('ext:') === 0, 'Unknown scheme: ' + options.scheme);
    }

    Log.event(['info', 'config', 'auth'], server.settings.nickname + ': Authentication enabled');
    return this;
};


internals.Auth.prototype.authenticate = function (request, next) {

    return this.scheme.authenticate(request, next);
};

