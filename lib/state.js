// Load modules

var Querystring = require('querystring');
var Iron = require('iron');
var Async = require('async');
var Cryptiles = require('cryptiles');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {
    macPrefix: 'hapi.signed.cookie.1'
};


// Header format

//                      1: name                2: quoted  3: value
internals.parseRx = /\s*([^=\s]+)\s*=\s*(?:(?:"([^\"]*)")|([^\;]*))(?:(?:;|(?:\s*\,)\s*)|$)/g;

internals.validateRx = {
    nameRx: {
        strict: /^[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+$/,
        loose: /^[^=\s]+$/
    },
    valueRx: {
        strict: /^[^\x00-\x20\"\,\;\\\x7F]*$/,
        loose: /^(?:"([^\"]*)")|(?:[^\;]*)$/
    },
    domainRx: /^\.?[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d]))(?:\.[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d])))*$/,
    domainLabelLenRx: /^\.?[a-z\d\-]{1,63}(?:\.[a-z\d\-]{1,63})*$/,
    pathRx: /^\/[^\x00-\x1F\;]*$/
};


// Read and parse body

exports.parseCookies = function (request, next) {

    var prepare = function () {

        request.state = {};

        var req = request.raw.req;
        var cookies = req.headers.cookie;
        if (!cookies) {
            return next();
        }

        header(cookies);
    };

    var header = function (cookies) {

        var state = {};
        var verify = cookies.replace(internals.parseRx, function ($0, $1, $2, $3) {

            var name = $1;
            var value = $2 || $3 || '';

            if (state[name]) {
                if (!Array.isArray(state[name])) {
                    state[name] = [state[name]];
                }

                state[name].push(value);
            }
            else {
                state[name] = value;
            }

            return '';
        });

        // Validate cookie header syntax

        if (verify !== '' &&
            shouldStop(cookies)) {

            return;     // shouldStop calls next()
        }

        // Validate cookie

        if (request.server.settings.state.cookies.strictHeader) {
            var names = Object.keys(state);
            for (var i = 0, il = names.length; i < il; ++i) {
                var name = names[i];
                if (!name.match(internals.validateRx.nameRx.strict)) {
                    if (shouldStop(cookies, name)) {
                        return;     // shouldStop calls next()
                    }
                }

                var values = [].concat(state[name]);
                for (var v = 0, vl = values.length; v < vl; ++v) {
                    var value = values[v];
                    if (!value.match(internals.validateRx.valueRx.strict)) {
                        if (shouldStop(cookies, name)) {
                            return;     // shouldStop calls next()
                        }
                    }
                }
            }
        }

        parse(state);
    };

    var parse = function (state) {

        var parsed = {};

        var names = Object.keys(state);
        Async.forEachSeries(names, function (name, nextName) {

            var value = state[name];

            var definition = request.server._stateDefinitions[name];
            if (!definition ||
                !definition.encoding) {

                parsed[name] = value;
                return nextName();
            }

            // Single value

            if (Array.isArray(value) === false) {
                unsign(name, value, definition, function (err, unsigned) {

                    if (err) {
                        if (shouldStop({ name: name, value: value, settings: definition, reason: err.message }, name)) {
                            return;     // shouldStop calls next()
                        }

                        return nextName();
                    }

                    decode(unsigned, definition, function (err, result) {

                        if (err) {
                            if (shouldStop({ name: name, value: value, settings: definition, reason: err.message }, name)) {
                                return;     // shouldStop calls next()
                            }

                            return nextName();
                        }

                        parsed[name] = result;
                        return nextName();
                    });
                });

                return;
            }

            // Array

            var arrayResult = [];
            Async.forEachSeries(value, function (arrayValue, nextArray) {

                unsign(name, arrayValue, definition, function (err, unsigned) {

                    if (err) {
                        if (shouldStop({ name: name, value: value, settings: definition, reason: err.message }, name)) {
                            return;     // shouldStop calls next()
                        }

                        return nextName();
                    }

                    decode(unsigned, definition, function (err, result) {

                        if (err) {
                            if (shouldStop({ name: name, value: value, settings: definition, reason: err.message }, name)) {
                                return;     // shouldStop calls next()
                            }

                            return nextName();
                        }

                        arrayResult.push(result);
                        nextArray();
                    });
                });
            },
            function (err) {

                parsed[name] = arrayResult;
                return nextName();
            });
        },
        function (err) {

            // All cookies parsed

            request.state = parsed;
            return next();
        });
    };

    // Extract signature and validate

    var unsign = function (name, value, definition, innerNext) {

        if (!definition.sign) {
            return innerNext(null, value);
        }

        var pos = value.lastIndexOf('.');
        if (pos === -1) {
            return innerNext(Boom.badRequest('Missing signature separator'));
        }

        var unsigned = value.slice(0, pos);
        var sig = value.slice(pos + 1);

        if (!sig) {
            return innerNext(Boom.badRequest('Missing signature'));
        }

        var sigParts = sig.split('*');
        if (sigParts.length !== 2) {
            return innerNext(Boom.badRequest('Bad signature format'));
        }

        var hmacSalt = sigParts[0];
        var hmac = sigParts[1];

        var macOptions = Utils.clone(definition.sign.integrity || Iron.defaults.integrity);
        macOptions.salt = hmacSalt;
        Iron.hmacWithPassword(definition.sign.password, macOptions, [internals.macPrefix, name, unsigned].join('\n'), function (err, mac) {

            if (err) {
                return innerNext(err);
            }

            if (!Cryptiles.fixedTimeComparison(mac.digest, hmac)) {
                return innerNext(Boom.badRequest('Bad hmac value'));
            }

            return innerNext(null, unsigned);
        });
    };

    // Decode values

    var decode = function (value, definition, innerNext) {

        // Encodings: 'base64json', 'base64', 'form', 'iron', 'none'

        if (definition.encoding === 'iron') {
            Iron.unseal(value, definition.password, definition.iron || Iron.defaults, function (err, unsealed) {

                if (err) {
                    return innerNext(err);
                }

                return innerNext(null, unsealed);
            });

            return;
        }

        var result = value;

        try {
            switch (definition.encoding) {
                case 'base64json':
                    var decoded = (new Buffer(value, 'base64')).toString('binary');
                    result = JSON.parse(decoded);
                    break;
                case 'base64':
                    result = (new Buffer(value, 'base64')).toString('binary');
                    break;
                case 'form':
                    result = Querystring.parse(value);
                    break;
            }
        }
        catch (err) {
            return innerNext(err);
        }

        return innerNext(null, result);
    };

    var shouldStop = function (error, name) {

        if (request.server.settings.state.cookies.clearInvalid &&
            name) {

            request._clearState(name);
        }

        // failAction: 'error', 'log', 'ignore'

        if (request.server.settings.state.cookies.failAction === 'log' ||
            request.server.settings.state.cookies.failAction === 'error') {

            request.log(['hapi', 'state', 'error'], error);
        }

        if (request.server.settings.state.cookies.failAction === 'error') {
            next(Boom.badRequest('Bad cookie ' + (name ? 'value: ' + Utils.escapeHtml(name) : 'header')));
            return true;
        }

        return false;
    };

    prepare();
};


exports.generateSetCookieHeader = function (cookies, server, callback) {

    var definitions = server._stateDefinitions || {};

    if (!cookies ||
        (Array.isArray(cookies) && !cookies.length)) {

        return Utils.nextTick(callback)(null, []);
    }

    if (Array.isArray(cookies) === false) {
        cookies = [cookies];
    }

    var header = [];

    var format = function () {

        Async.forEachSeries(cookies, function (cookie, next) {

            var options = cookie.options || {};

            // Apply server state configuration

            if (definitions[cookie.name]) {
                options = Utils.applyToDefaults(definitions[cookie.name], options);
            }

            // Validate name

            var nameRx = (server.settings.state.cookies.strictHeader ? internals.validateRx.nameRx.strict : internals.validateRx.nameRx.loose);
            if (!cookie.name.match(nameRx)) {
                return callback(Boom.badImplementation('Invalid cookie name: ' + cookie.name));
            }

            // Prepare value (encode, sign)

            exports.prepareValue(cookie.name, cookie.value, options, function (err, value) {

                if (err) {
                    return callback(err);
                }

                // Validate prepared value

                var valueRx = (server.settings.state.cookies.strictHeader ? internals.validateRx.valueRx.strict : internals.validateRx.valueRx.loose);
                if (value &&
                    (typeof value !== 'string' || !value.match(valueRx))) {

                    return callback(Boom.badImplementation('Invalid cookie value: ' + cookie.value));
                }

                // Construct cookie

                var segment = cookie.name + '=' + (value || '');

                if (options.ttl !== null &&
                    options.ttl !== undefined) {            // Can be zero

                    var expires = new Date(options.ttl ? Date.now() + options.ttl : 0);
                    segment += '; Max-Age=' + Math.floor(options.ttl / 1000) + '; Expires=' + expires.toUTCString();
                }

                if (options.isSecure) {
                    segment += '; Secure';
                }

                if (options.isHttpOnly) {
                    segment += '; HttpOnly';
                }

                if (options.domain) {
                    var domain = options.domain.toLowerCase();
                    if (!domain.match(internals.validateRx.domainLabelLenRx)) {
                        return callback(Boom.badImplementation('Cookie domain too long: ' + options.domain));
                    }

                    if (!domain.match(internals.validateRx.domainRx)) {
                        return callback(Boom.badImplementation('Invalid cookie domain: ' + options.domain));
                    }

                    segment += '; Domain=' + domain;
                }

                if (options.path) {
                    if (!options.path.match(internals.validateRx.pathRx)) {
                        return callback(Boom.badImplementation('Invalid cookie path: ' + options.path));
                    }

                    segment += '; Path=' + options.path;
                }

                header.push(segment);
                return next();
            });
        },
        function (err) {

            return callback(null, header);
        });
    };

    format();
};


exports.prepareValue = function (name, value, options, callback) {

    Utils.assert(options && typeof options === 'object', 'Missing or invalid options');

    // Encode value

    internals.encode(value, options, function (err, encoded) {

        if (err) {
            return callback(Boom.badImplementation('Failed to encode cookie (' + name + ') value: ' + err.message));
        }

        // Sign cookie

        internals.sign(name, encoded, options.sign, function (err, signed) {

            if (err) {
                return callback(Boom.badImplementation('Failed to sign cookie (' + name + ') value: ' + err.message));
            }

            return callback(null, signed);
        });
    });
};


internals.encode = function (value, options, callback) {

    callback = Utils.nextTick(callback);

    // Encodings: 'base64json', 'base64', 'form', 'iron', 'none'

    if (value === undefined) {
        return callback(null, value);
    }

    if (!options.encoding ||
        options.encoding === 'none') {

        return callback(null, value);
    }

    if (options.encoding === 'iron') {
        Iron.seal(value, options.password, options.iron || Iron.defaults, function (err, sealed) {

            if (err) {
                return callback(err);
            }

            return callback(null, sealed);
        });

        return;
    }

    var result = value;

    try {
        switch (options.encoding) {
            case 'base64':
                result = (new Buffer(value, 'binary')).toString('base64');
                break;
            case 'base64json':
                var stringified = JSON.stringify(value);
                result = (new Buffer(stringified, 'binary')).toString('base64');
                break;
            case 'form':
                result = Querystring.stringify(value);
                break;
        }
    }
    catch (err) {
        return callback(err);
    }

    return callback(null, result);
};


internals.sign = function (name, value, options, callback) {

    if (value === undefined ||
        !options) {

        return Utils.nextTick(callback)(null, value);
    }

    Iron.hmacWithPassword(options.password, options.integrity || Iron.defaults.integrity, [internals.macPrefix, name, value].join('\n'), function (err, mac) {

        if (err) {
            return callback(err);
        }

        var signed = value + '.' + mac.salt + '*' + mac.digest;
        return callback(null, signed);
    });
};

