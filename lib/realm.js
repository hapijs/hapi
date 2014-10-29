// Load modules

var Os = require('os');
var Hoek = require('hoek');
var Schema = require('./schema');


// Declare internals

var internals = {};


internals.defaults = {
    connection: {

        // TLS

        // tls: {
        //
        //     key: '',
        //     cert: ''
        // },

        maxSockets: Infinity,                           // Sets http/https globalAgent maxSockets value. null is node default.

        // Router

        router: {
            isCaseSensitive: true,                      // Case-sensitive paths
            stripTrailingSlash: false                   // Remove trailing slash from incoming paths
        },

        // State

        state: {
            cookies: {
                parse: true,                            // Parse content of req.headers.cookie
                failAction: 'error',                    // Action on bad cookie - 'error': return 400, 'log': log and continue, 'ignore': continue
                clearInvalid: false,                    // Automatically instruct the client to remove the invalid cookie
                strictHeader: true                      // Require an RFC 6265 compliant header format
            }
        },

        // Location

        location: '',                                   // Base uri used to prefix non-absolute outgoing Location headers ('http://example.com:8080'). Must not contain trailing '/'.

        // Cache header

        cacheControlStatus: [200],                      // Array of HTTP statuc codes for which cache-control header is set

        // Payload

        payload: {
            maxBytes: 1024 * 1024,
            uploads: Os.tmpDir()
        },

        // Validation

        validation: null,                               // Joi validation options

        // JSON

        json: {
            replacer: null,
            space: null,
            suffix: null
        },

        // Files path

        files: {
            relativeTo: '.',                            // Determines what file and directory handlers use to base relative paths off
            etagsCacheMaxSize: 10000                    // Maximum number of etags in the cache
        },

        // timeout limits

        timeout: {
            socket: undefined,                          // Determines how long before closing request socket. Defaults to node (2 minutes)
            client: 10 * 1000,                          // Determines how long to wait for receiving client payload. Defaults to 10 seconds
            server: false                               // Determines how long to wait for server request processing. Disabled by default
        },

        // Debug

        debug: {
            request: ['implementation']
        },

        // Pack

        labels: [],                                     // Connection pack labels

        // Optional components

        cors: false,                                    // CORS headers on responses and OPTIONS requests (defaults: exports.cors): false -> null, true -> defaults, {} -> override defaults
        security: false                                 // Security headers on responses (defaults exports.security): false -> null, true -> defaults, {} -> override defaults
    },
    cors: {
        origin: ['*'],
        isOriginExposed: true,                          // Return the list of supported origins if incoming origin does not match
        matchOrigin: true,                              // Attempt to match incoming origin against allowed values and return narrow response
        maxAge: 86400,                                  // One day
        headers: [
            'Authorization',
            'Content-Type',
            'If-None-Match'
        ],
        additionalHeaders: [],
        methods: [
            'GET',
            'HEAD',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],
        additionalMethods: [],
        exposedHeaders: [
            'WWW-Authenticate',
            'Server-Authorization'
        ],
        additionalExposedHeaders: [],
        credentials: false
    },
    security: {
        hsts: 15768000,
        xframe: 'deny',
        xss: true,
        noOpen: true,
        noSniff: true
    }
};


exports = module.exports = internals.Realm = function (options) {

    this.settings = internals.configure(options);
};


internals.configure = function (options) {

    var settings = Hoek.applyToDefaultsWithShallow(internals.defaults.connection, options || {}, ['app', 'plugins']);

    Schema.assert('server', settings);

    settings.labels = Hoek.unique([].concat(settings.labels));       // Convert string to array and removes duplicates

    // Set basic configuration

    Hoek.assert(!settings.location || settings.location.charAt(settings.location.length - 1) !== '/', 'Location setting must not contain a trailing \'/\'');

    var socketTimeout = (settings.timeout.socket === undefined ? 2 * 60 * 1000 : settings.timeout.socket);
    Hoek.assert(!settings.timeout.server || !socketTimeout || settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
    Hoek.assert(!settings.timeout.client || !socketTimeout || settings.timeout.client < socketTimeout, 'Client timeout must be shorter than socket timeout');

    // Generate CORS headers

    settings.cors = Hoek.applyToDefaults(internals.defaults.cors, settings.cors);
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

    settings.security = Hoek.applyToDefaults(internals.defaults.security, settings.security);
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


internals.Realm.debug = internals.defaults.connection.debug;
