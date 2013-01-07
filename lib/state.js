// Load modules

var Err = require('./error');


// Declare internals

var internals = {};


// Read and parse body

exports.parseCookies = function (request, next) {

    if (!request.server.settings.state.cookies.parse) {
        return next();
    }

    request.cookies = null;

    var req = request.raw.req;
    var cookies = req.headers.cookie;
    if (!cookies) {
        return next();
    }

    request.cookies = {};

    //                               1: name                                                       2: quoted value               3: value
    var verify = cookies.replace(/\s*([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:(?:"([^\x00-\x20\"\,\;\\\x7F]*)")|([^\x00-\x20\"\,\;\\\x7F]*))(?:(?:;|(?:\s*\,)\s*)|$)/g, function ($0, $1, $2, $3) {

        var value = $2 || $3;

        if (request.server.settings.state.cookies.parseValues) {
            try {
                value = decodeURIComponent(value);
            } catch (e) { }

            try {
                value = JSON.parse(value);
            } catch (e) { }
        }

        if (request.cookies[$1]) {
            if (request.cookies[$1] instanceof Array === false) {
                request.cookies[$1] = [request.cookies[$1]];
            }

            request.cookies[$1].push(value);
        }
        else {
            request.cookies[$1] = value;
        }

        return '';
    });

    // Validate cookie header

    if (verify !== '') {

        // failAction: 'error', 'log', 'ignore'

        if (request.server.settings.state.cookies.failAction === 'error') {
            return next(Err.badRequest('Bad cookie header format'));
        }

        if (request.server.settings.state.cookies.failAction === 'log') {
            request.log(['cookies', 'error'], cookies);
        }
    }

    return next();
};


internals.nameRegx = /^[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+$/;
internals.valueRegx = /^[^\x00-\x20\"\,\;\\\x7F]*$/;
internals.domainRegx = /^[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d]))(?:\.[a-z\d]+(?:(?:[a-z\d]*)|(?:[a-z\d\-]*[a-z\d])))*$/;
internals.domainLabelLenRegx = /^[a-z\d\-]{1,63}(?:\.[a-z\d\-]{1,63})*$/;
internals.pathRegx = /^\/[^\x00-\x1F\;]*$/;


exports.setCookieHeader = function (cookies) {

    if (!cookies ||
        (cookies instanceof Array && cookie.length)) {

        return [];
    }

    cookies = (cookies instanceof Array ? cookies : [cookies]);

    var header = [];
    for (var i = 0, il = cookies.length; i < il; ++i) {
        var cookie = cookies[i];

        // Validate name and value

        if (!cookie.name.match(internals.nameRegx)) {
            return Err.internal('Invalid cookie name: ' + cookie.name);
        }

        if (!cookie.value.match(internals.valueRegx)) {
            return Err.internal('Invalid cookie value: ' + cookie.value);
        }

        var segment = cookie.name + '=' + cookie.value;

        if (cookie.ttl) {
            var expires = new Date(Date.now() + cookie.ttl);
            segment += '; Max-Age=' + cookie.ttl + '; Expires=' + expires.toUTCString();
        }

        if (cookie.isSecure) {
            segment += '; Secure';
        }

        if (cookie.isHttpOnly) {
            segment += '; HttpOnly';
        }

        if (cookie.domain) {
            var domain = cookie.domain.toLowerCase();
            if (!domain.match(internals.domainLabelLenRegx)) {
                return Err.internal('Cookie domain too long: ' + cookie.domain);
            }

            if (!domain.match(internals.domainRegx)) {
                return Err.internal('Invalid cookie domain: ' + cookie.domain);
            }

            segment += '; Domain=' + domain;
        }

        if (cookie.path) {
            if (!cookie.path.match(internals.pathRegx)) {
                return Err.internal('Invalid cookie path: ' + cookie.path);
            }

            segment += '; Path=' + cookie.path;
        }

        header.push(segment);
    }

    return header;
};

