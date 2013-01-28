// Load modules

var Querystring = require('querystring');
var Iron = require('iron');
var Async = require('async');
var Cryptiles = require('cryptiles');
var Err = require('./error');
var Utils = require('./utils');


// Declare internals

var internals = {
    macPrefix: 'hapi.signed.cookie.1'
};


// Read and parse body

exports.parseCookies = function (request, next) {

    var prepare = function () {

        if (!request.server.settings.state.cookies.parse) {
            return next();
        }

        request.state = null;

        var req = request.raw.req;
        var cookies = req.headers.cookie;
        if (!cookies) {
            return next();
        }

        request.state = {};
        header(cookies);
    };

    var header = function (cookies) {

        //                               1: name                                                       2: quoted value               3: value
        var verify = cookies.replace(/\s*([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:(?:"([^\x00-\x20\"\,\;\\\x7F]*)")|([^\x00-\x20\"\,\;\\\x7F]*))(?:(?:;|(?:\s*\,)\s*)|$)/g, function ($0, $1, $2, $3) {

            var name = $1;
            var value = $2 || $3;

            if (request.state[name]) {
                if (request.state[name] instanceof Array === false) {
                    request.state[name] = [request.state[name]];
                }

                request.state[name].push(value);
            }
            else {
                request.state[name] = value;
            }

            return '';
        });

        // Validate cookie header syntax

        if (verify !== '' &&
            shouldStop(cookies)) {

            return;     // shouldStop calls next()
        }

        parse();
    };

    var shouldStop = function (error, name) {

        // failAction: 'error', 'log', 'ignore'

        if (request.server.settings.state.cookies.failAction === 'error') {
            next(Err.badRequest('Bad cookie ' + (name ? 'value: ' + name : 'header')));
            return true;
        }

        if (request.server.settings.state.cookies.failAction === 'log') {
            request.log(['state', 'error'], error);
        }

        return false;
    };

    var parse = function () {

        var names = Object.keys(request.state);
        Async.forEachSeries(names, function (name, nextName) {

            var definition = request.server._stateDefinitions[name];
            if (!definition ||
                !definition.encoding) {

                return nextName();
            }

            var value = request.state[name];

            // Single value

            if (value instanceof Array === false) {
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

                        request.state[name] = result;
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

                            arrayResult.push(arrayValue);           // Keep bad value
                            return nextArray();
                        }

                        arrayResult.push(result);
                        nextArray();
                    });
                });
            },
            function (err) {

                request.state[name] = arrayResult;
                return nextName();
            });
        },
        function (err) {

            return next();
        });
    };

    // Extract signature and validate

    var unsign = function (name, value, definition, callback) {

        if (!definition ||
            !definition.sign) {

            return callback(null, value);
        }

        var pos = value.lastIndexOf('.');
        if (pos === -1) {
            return callback(Err.internal('Missing signature separator'));
        }

        var unsigned = value.slice(0, pos);
        var sig = value.slice(pos + 1);

        if (!sig) {
            return callback(Err.internal('Missing signature'));
        }

        sigParts = sig.split('*');
        if (sigParts.length !== 2) {
            return callback(Err.internal('Bad signature format'));
        }

        var hmacSalt = sigParts[0];
        var hmac = sigParts[1];

        var macOptions = Utils.clone(definition.sign.integrity || Iron.defaults.integrity);
        macOptions.salt = hmacSalt;
        Iron.hmacWithPassword(definition.sign.password, macOptions, [internals.macPrefix, name, unsigned].join('\n'), function (err, mac) {

            if (err) {
                return callback(err);
            }

            if (!Cryptiles.fixedTimeComparison(mac.digest, hmac)) {
                return callback(Err.internal('Bad hmac value'));
            }

            return callback(null, unsigned);
        });
    };

    // Decode values

    var decode = function (value, definition, callback) {

        // Encodings: 'base64json', 'base64', 'form', 'iron', 'none'

        if (definition.encoding === 'iron') {
            Iron.unseal(value, definition.password, definition.iron || Iron.defaults, function (err, unsealed) {

                if (err) {
                    return callback(err);
                }

                return callback(null, unsealed);
            });

            return;
        }

        var result = null;

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
            return callback(err);
        }

        return callback(null, result);
    };

    prepare();
};


internals.nameRegx = /^[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+$/;
internals.valueRegx = /^[^\x00-\x20\"\,\;\\\x7F]*$/;
internals.domainRegx = /^[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d]))(?:\.[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d])))*$/;
internals.domainLabelLenRegx = /^[a-z\d\-]{1,63}(?:\.[a-z\d\-]{1,63})*$/;
internals.pathRegx = /^\/[^\x00-\x1F\;]*$/;


exports.generateSetCookieHeader = function (cookies, definitions, callback) {

    definitions = definitions || {};

    if (!cookies ||
        (cookies instanceof Array && !cookies.length)) {

        return callback(null, []);
    }

    if (cookies instanceof Array === false) {
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

            if (!cookie.name.match(internals.nameRegx)) {
                return callback(Err.internal('Invalid cookie name: ' + cookie.name));
            }

            // Encode value

            encode(cookie.value, options, function (err, value) {

                if (err) {
                    return callback(Err.internal('Failed to encode cookie (' + cookie.name + ') value' + (err.message ? ': ' + err.message : '')));
                }

                // Validate value

                if (typeof value !== 'string' ||
                    !value.match(internals.valueRegx)) {

                    return callback(Err.internal('Invalid cookie value: ' + cookie.value));
                }

                // Sign cookie

                sign(cookie.name, value, options.sign, function (err, signed) {

                    if (err) {
                        return callback(Err.internal('Failed to sign cookie (' + cookie.name + ') value' + (err.message ? ': ' + err.message : '')));
                    }

                    // Construct cookie

                    var segment = cookie.name + '=' + signed;

                    if (options.ttl !== null &&
                        options.ttl !== undefined) {            // Can be zero

                        var expires = new Date(options.ttl ? Date.now() + options.ttl : 0);
                        segment += '; Max-Age=' + options.ttl + '; Expires=' + expires.toUTCString();
                    }

                    if (options.isSecure) {
                        segment += '; Secure';
                    }

                    if (options.isHttpOnly) {
                        segment += '; HttpOnly';
                    }

                    if (options.domain) {
                        var domain = options.domain.toLowerCase();
                        if (!domain.match(internals.domainLabelLenRegx)) {
                            return callback(Err.internal('Cookie domain too long: ' + options.domain));
                        }

                        if (!domain.match(internals.domainRegx)) {
                            return callback(Err.internal('Invalid cookie domain: ' + options.domain));
                        }

                        segment += '; Domain=' + domain;
                    }

                    if (options.path) {
                        if (!options.path.match(internals.pathRegx)) {
                            return callback(Err.internal('Invalid cookie path: ' + options.path));
                        }

                        segment += '; Path=' + options.path;
                    }

                    header.push(segment);
                    return next();
                });
            });
        },
        function (err) {

            return callback(null, header);
        });
    };

    var encode = function (value, definition, encodeCallback) {

        // Encodings: 'base64json', 'base64', 'form', 'iron', 'none'

        if (!definition ||
            !definition.encoding ||
            definition.encoding === 'none') {

            return encodeCallback(null, value);
        }

        if (definition.encoding === 'iron') {
            Iron.seal(value, definition.password, definition.iron || Iron.defaults, function (err, sealed) {

                if (err) {
                    return encodeCallback(err);
                }

                return encodeCallback(null, sealed);
            });

            return;
        }

        var result = value;

        try {
            switch (definition.encoding) {
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
            return encodeCallback(err);
        }

        return encodeCallback(null, result);
    };

    var sign = function (name, value, options, signCallback) {

        if (!options) {
            return signCallback(null, value);
        }

        Iron.hmacWithPassword(options.password, options.integrity || Iron.defaults.integrity, [internals.macPrefix, name, value].join('\n'), function (err, mac) {

            if (err) {
                return signCallback(err);
            }

            var signed = value + '.' + mac.salt + '*' + mac.digest;
            return signCallback(null, signed);
        });
    };

    format();
};

