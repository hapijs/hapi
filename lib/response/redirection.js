// Load modules

var NodeUtil = require('util');
var Text = require('./text');


// Declare internals

var internals = {};


// Text response (Base -> Generic -> Cacheable -> Text -> Redirection)

exports = module.exports = internals.Text = function (uri, message, type) {

    Text.call(this, message || 'You are being redirected...', type);
    this._tag = 'redirection';

    delete this.created;

    this._code = 302;                                   // Defaults to temporary/rewritable
    this._flags.location = uri;

    return this;
};

NodeUtil.inherits(internals.Text, Text);


internals.Text.prototype.uri = function (uri) {

    this._flags.location = uri;
    return this;
};


internals.Text.prototype.temporary = function (isTemporary) {

    this.setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Text.prototype.permanent = function (isPermanent) {

    this.setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Text.prototype.rewritable = function (isRewritable) {

    this.setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Text.prototype.isTemporary = function () {

    return this._code === 302 || this._code === 307;
};


internals.Text.prototype.isRewritable = function () {

    return this._code === 301 || this._code === 302;
};


internals.Text.prototype.setTemporary = function (isTemporary) {

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


internals.Text.prototype.setRewritable = function (isRewritable) {

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

