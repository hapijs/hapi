// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Text response (Base -> Generic -> Cacheable -> Text)

exports = module.exports = internals.Text = function (text, type) {

    Cacheable.call(this);
    this._tag = 'text';

    this.message(text, type);

    return this;
};

NodeUtil.inherits(internals.Text, Cacheable);


internals.Text.prototype.message = function (text, type) {

    this._payload = text || '';
    this._headers['Content-Type'] = type || 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);

    return this;
};

