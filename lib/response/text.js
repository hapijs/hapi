// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');


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

Utils.inherits(internals.Text, Cacheable);


internals.Text.prototype.message = function (text, type, encoding) {

    if (text) {
        this._payload = [text];
    }

    this._headers['Content-Type'] = type || 'text/html';
    this._flags.encoding = encoding || 'utf-8';

    return this;
};

