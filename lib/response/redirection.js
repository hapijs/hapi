// Load modules

var Text = require('./text');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Redirection response (Base -> Generic -> Cacheable -> Text -> Redirection)

exports = module.exports = internals.Redirection = function (uri, message, type) {

    Text.call(this, message || 'You are being redirected...', type);
    this.variety = 'redirection';
    this.varieties.redirection = true;

    delete this.created;

    this._code = 302;                                   // Defaults to temporary/rewritable
    this._flags.location = uri;

    return this;
};

Utils.inherits(internals.Redirection, Text);


internals.Redirection.prototype.uri = function (uri) {

    this._flags.location = uri;
    return this;
};


internals.Redirection.prototype.temporary = function (isTemporary) {

    this.setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Redirection.prototype.permanent = function (isPermanent) {

    this.setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Redirection.prototype.rewritable = function (isRewritable) {

    this.setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Redirection.prototype.isTemporary = function () {

    return this._code === 302 || this._code === 307;
};


internals.Redirection.prototype.isRewritable = function () {

    return this._code === 301 || this._code === 302;
};


internals.Redirection.prototype.setTemporary = function (isTemporary) {

    if (isTemporary) {
        if (this.isRewritable()) {
            this._code = 302;
        }
        else {
            this._code = 307;
        }
    }
    else {
        if (this.isRewritable()) {
            this._code = 301;
        }
        else {
            this._code = 308;
        }
    }
};


internals.Redirection.prototype.setRewritable = function (isRewritable) {

    if (isRewritable) {
        if (this.isTemporary()) {
            this._code = 302;
        }
        else {
            this._code = 301;
        }
    }
    else {
        if (this.isTemporary()) {
            this._code = 307;
        }
        else {
            this._code = 308;
        }
    }
};

