// Load modules

var Text = require('./text');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Redirection response (Generic -> Cacheable -> Text -> Redirection)

exports = module.exports = internals.Redirection = function (uri, message, type, encoding) {

    Text.call(this, message || 'You are being redirected...', type, encoding);
    this.variety = 'redirection';
    this.varieties.redirection = true;

    delete this.created;

    this._code = 302;               // Defaults to temporary/rewritable
    this.uri(uri);
};

Utils.inherits(internals.Redirection, Text);


internals.Redirection.prototype.uri = function (uri) {

    this._flags.location = uri;
    return this;
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

