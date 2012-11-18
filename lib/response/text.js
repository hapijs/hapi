// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Text response (Base -> Generic -> Cacheable -> Text)

exports = module.exports = internals.Text = function (text, type) {

    Cacheable.call(this);
    this._tag = 'text';

    this._payload = text;
    this.headers['Content-Type'] = type || 'text/html';
    this.headers['Content-Length'] = Buffer.byteLength(this._payload);

    return this;
};

NodeUtil.inherits(internals.Text, Cacheable);
