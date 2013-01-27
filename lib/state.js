// Load modules

var Querystring = require('querystring');
var Iron = require('iron');
var Async = require('async');
var Err = require('./error');
var Utils = require('./utils');


// Declare internals

var internals = {};


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

        if (verify !== '') {
            if (request.server.settings.state.cookies.failAction === 'error') {         // failAction: 'error', 'log', 'ignore'
                return next(Err.badRequest('Bad cookie header'));
            }

            if (request.server.settings.state.cookies.failAction === 'log') {
                request.log(['state', 'error'], cookies);
            }
        }

        parse();
    };

    var parse = function () {

        var names = Object.keys(request.state);
        Async.forEachSeries(names, function (name, nextName) {

            var definition = request.server._stateDefinitions[name];
            var encoding = (definition && definition.encoding) || 'none';
            if (encoding === 'none') {
                return nextName();
            }

            var value = request.state[name];

            // Single value

            if (value instanceof Array === false) {
                decode(value, encoding, definition, function (err, result) {

                    if (err) {
                        if (request.server.settings.state.cookies.failAction === 'error') {         // failAction: 'error', 'log', 'ignore'
                            return next(Err.badRequest('Bad cookie value: ' + name));
                        }

                        if (request.server.settings.state.cookies.failAction === 'log') {
                            request.log(['state', 'error'], { name: name, value: value, settings: definition, reason: err.message });
                        }

                        return nextName();
                    }

                    request.state[name] = result;
                    return nextName();
                });

                return;
            }

            // Array

            var arrayResult = [];
            Async.forEachSeries(value, function (arrayValue, nextArray) {

                decode(arrayValue, encoding, definition, function (err, result) {

                    if (err) {
                        if (request.server.settings.state.cookies.failAction === 'error') {         // failAction: 'error', 'log', 'ignore'
                            return next(Err.badRequest('Bad cookie value: ' + name));
                        }

                        if (request.server.settings.state.cookies.failAction === 'log') {
                            request.log(['state', 'error'], { name: name, value: value, settings: definition, reason: err.message });
                        }

                        arrayResult.push(arrayValue);           // Keep bad value
                        return nextArray();
                    }

                    arrayResult.push(result);
                    nextArray();
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

    // Decode values

    var decode = function (value, encoding, definition, callback) {

        // Encodings: 'base64json', 'base64', 'form', 'iron', 'none'

        if (encoding === 'iron') {
            Iron.unseal(value, definition.password, definition.options || Iron.defaults, function (err, unsealed) {

                if (err) {
                    return callback(err);
                }

                return callback(null, unsealed);
            });

            return;
        }

        var result = null;

        try {
            switch (encoding) {
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


exports.generateSetCookieHeader = function (cookies, definitions) {

    definitions = definitions || {};

    if (!cookies ||
        (cookies instanceof Array && !cookies.length)) {

        return [];
    }

    if (cookies instanceof Array === false) {
        cookies = [cookies];
    }

    var header = [];
    for (var i = 0, il = cookies.length; i < il; ++i) {
        var cookie = cookies[i];
        var options = cookie.options || {};

        // Apply server state configuration

        if (definitions[cookie.name]) {
            options = Utils.applyToDefaults(definitions[cookie.name], options);
        }

        // Validate name

        if (!cookie.name.match(internals.nameRegx)) {
            return Err.internal('Invalid cookie name: ' + cookie.name);
        }

        // Encode value

        var value = cookie.value;
        if (options.encoding &&
            options.encoding !== 'none') {

            // Encodings: 'base64json', 'base64', 'form', 'none'

            try {
                switch (options.encoding) {
                    case 'base64':
                        value = (new Buffer(value, 'binary')).toString('base64');
                        break;
                    case 'base64json':
                        var stringified = JSON.stringify(value);
                        value = (new Buffer(stringified, 'binary')).toString('base64');
                        break;
                    case 'form':
                        value = Querystring.stringify(value);
                        break;
                }
            }
            catch (e) {
                return Err.internal('Failed to encode cookie (' + cookie.name + ') value' + (e.message ? ': ' + e.message : ''));
            }
        }

        // Validate value

        if (typeof value !== 'string' ||
            !value.match(internals.valueRegx)) {

            return Err.internal('Invalid cookie value: ' + cookie.value);
        }

        // Construct cookie

        var segment = cookie.name + '=' + value;

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
                return Err.internal('Cookie domain too long: ' + options.domain);
            }

            if (!domain.match(internals.domainRegx)) {
                return Err.internal('Invalid cookie domain: ' + options.domain);
            }

            segment += '; Domain=' + domain;
        }

        if (options.path) {
            if (!options.path.match(internals.pathRegx)) {
                return Err.internal('Invalid cookie path: ' + options.path);
            }

            segment += '; Path=' + options.path;
        }

        header.push(segment);
    }

    return header;
};

