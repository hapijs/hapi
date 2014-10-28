// Load modules

var Hoek = require('hoek');
var Defaults = require('./defaults');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports = module.exports = internals.Realm = function (options) {

    this.settings = internals.configure(options);
};


internals.configure = function (options) {

    var settings = Hoek.applyToDefaultsWithShallow(Defaults.connection, options || {}, ['app', 'plugins']);

    Schema.assert('server', settings);

    settings.labels = Hoek.unique([].concat(settings.labels));       // Convert string to array and removes duplicates

    // Set basic configuration

    Hoek.assert(!settings.location || settings.location.charAt(settings.location.length - 1) !== '/', 'Location setting must not contain a trailing \'/\'');

    var socketTimeout = (settings.timeout.socket === undefined ? 2 * 60 * 1000 : settings.timeout.socket);
    Hoek.assert(!settings.timeout.server || !socketTimeout || settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
    Hoek.assert(!settings.timeout.client || !socketTimeout || settings.timeout.client < socketTimeout, 'Client timeout must be shorter than socket timeout');

    // Generate CORS headers

    settings.cors = Hoek.applyToDefaults(Defaults.cors, settings.cors);
    if (settings.cors) {
        settings.cors._headers = settings.cors.headers.concat(settings.cors.additionalHeaders).join(', ');
        settings.cors._methods = settings.cors.methods.concat(settings.cors.additionalMethods).join(', ');
        settings.cors._exposedHeaders = settings.cors.exposedHeaders.concat(settings.cors.additionalExposedHeaders).join(', ');

        if (settings.cors.origin.length) {
            settings.cors._origin = {
                any: false,
                qualified: [],
                qualifiedString: '',
                wildcards: []
            };

            if (settings.cors.origin.indexOf('*') !== -1) {
                Hoek.assert(settings.cors.origin.length === 1, 'Cannot specify cors.origin * together with other values');
                settings.cors._origin.any = true;
            }
            else {
                for (var c = 0, cl = settings.cors.origin.length; c < cl; ++c) {
                    var origin = settings.cors.origin[c];
                    if (origin.indexOf('*') !== -1) {
                        settings.cors._origin.wildcards.push(new RegExp('^' + Hoek.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
                    }
                    else {
                        settings.cors._origin.qualified.push(origin);
                    }
                }

                Hoek.assert(settings.cors.matchOrigin || !settings.cors._origin.wildcards.length, 'Cannot include wildcard origin values with matchOrigin disabled');
                settings.cors._origin.qualifiedString = settings.cors._origin.qualified.join(' ');
            }
        }
    }

    // Generate security headers

    settings.security = Hoek.applyToDefaults(Defaults.security, settings.security);
    if (settings.security) {
        if (settings.security.hsts) {
            if (settings.security.hsts === true) {
                settings.security._hsts = 'max-age=15768000';
            }
            else if (typeof settings.security.hsts === 'number') {
                settings.security._hsts = 'max-age=' + settings.security.hsts;
            }
            else {
                settings.security._hsts = 'max-age=' + (settings.security.hsts.maxAge || 15768000);
                if (settings.security.hsts.includeSubdomains) {
                    settings.security._hsts += '; includeSubdomains';
                }
            }
        }

        if (settings.security.xframe) {
            if (settings.security.xframe === true) {
                settings.security._xframe = 'DENY';
            }
            else if (typeof settings.security.xframe === 'string') {
                settings.security._xframe = settings.security.xframe.toUpperCase();
            }
            else if (settings.security.xframe.rule === 'allow-from') {
                if (!settings.security.xframe.source) {
                    settings.security._xframe = 'SAMEORIGIN';
                }
                else {
                    settings.security._xframe = 'ALLOW-FROM ' + settings.security.xframe.source;
                }
            }
            else {
                settings.security._xframe = settings.security.xframe.rule.toUpperCase();
            }
        }
    }

    // Cache-control status map

    settings._cacheControlStatus = Hoek.mapToObject(settings.cacheControlStatus);

    return settings;
};
