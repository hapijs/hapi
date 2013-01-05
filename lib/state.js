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

    // Based on RFC 6265:
    // cookie-string = cookie-pair *( ";" / "," OWS cookie-pair )           ; adjusted to allow ','
    // cookie-pair       = token OWS "=" OWS cookie-value                   ; adjusted to allow OWS
    // token             = [^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+
    // cookie-value      = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )
    // cookie-octet      = [^\x00-\x20\"\,\;\\\x7F]

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




