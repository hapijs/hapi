// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Redirection response (Generic -> Text -> Redirection)

exports = module.exports = internals.Redirection = function (uri, message, type, encoding) {

    Generic.call(this);
    this.variety = 'redirection';

    this.created = undefined;       // Cannot delete off prototype

    this._code = 302;               // Defaults to temporary/rewritable
    this.message(message || 'You are being redirected...', type, encoding);
    this.location(uri);
};

Utils.inherits(internals.Redirection, Generic);


internals.Redirection.prototype.message = function (text, type, encoding) {

    this.source = text;
    this._header('content-type', type || 'text/html');
    this.encoding(encoding);

    return this;
};


internals.Redirection.prototype._prepare = function (request, callback) {

    this._payload = new Payload(this.source);
    return Generic.prototype._prepare.call(this, request, callback);
};


internals.Redirection.prototype.temporary = function (isTemporary) {

    this._setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Redirection.prototype.permanent = function (isPermanent) {

    this._setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Redirection.prototype.rewritable = function (isRewritable) {

    this._setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Redirection.prototype._isTemporary = function () {

    return this._code === 302 || this._code === 307;
};


internals.Redirection.prototype._isRewritable = function () {

    return this._code === 301 || this._code === 302;
};


internals.Redirection.prototype._setTemporary = function (isTemporary) {

    if (isTemporary) {
        if (this._isRewritable()) {
            this._code = 302;
        }
        else {
            this._code = 307;
        }
    }
    else {
        if (this._isRewritable()) {
            this._code = 301;
        }
        else {
            this._code = 308;
        }
    }
};


internals.Redirection.prototype._setRewritable = function (isRewritable) {

    if (isRewritable) {
        if (this._isTemporary()) {
            this._code = 302;
        }
        else {
            this._code = 301;
        }
    }
    else {
        if (this._isTemporary()) {
            this._code = 307;
        }
        else {
            this._code = 308;
        }
    }
};

