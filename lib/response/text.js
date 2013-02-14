// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Text response (Base -> Generic -> Cacheable -> Text)

exports = module.exports = internals.Text = function (text, type) {

    Cacheable.call(this);
    this.variety = 'text';
    this.varieties.text = true;

    this.message(text, type);

    return this;
};

NodeUtil.inherits(internals.Text, Cacheable);


internals.Text.prototype.message = function (text, type) {

    if (text) {
        this._payload = [text];
    }

    this._headers['Content-Type'] = type || 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(text);

    return this;
};

