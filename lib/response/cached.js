// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cached response (Generic -> Cacheable -> Cached)

exports = module.exports = internals.Cached = function (item, ttl) {

    Generic.call(this);
    this.variety = 'cached';
    this.varieties.cached = true;

    this._code = item.code;
    this._payload = [item.payload];
    this._headers = item.headers;

    Utils.merge(this._flags, item.flags);
    this._flags.ttl = ttl;
};

Utils.inherits(internals.Cached, Generic);


/*
Generic

    _code (200)

        header() -> _headers
        encoding() -> _flags (encoding)
        charset() -> _flags (charset)
        ttl() -> _flags (ttl)              - ttl cached but ignored

Text

    _code (200)
    _payload
    _headers (content-type)
    _flags (encoding)

Redirection

    _code (301, 302, 307, 308)
    _payload
    _headers (content-type)
    _flags (encoding, location)

Empty

    _code (200)

Object

    _code (200)
    _payload
    _headers (content-type)
    _flags (encoding)

Cached

    _code
    _payload
    _headers
    _flags + (ttl)
*/