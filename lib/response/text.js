// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');


// Declare internals

var internals = {};


// Text response

exports = module.exports = internals.Text = function (text, type) {

    Generic.call(this);
    this._tag = 'text';

    this.payload = text;
    this.headers['Content-Type'] = type || 'text/html';
    this.headers['Content-Length'] = Buffer.byteLength(this.payload);

    return this;
};

NodeUtil.inherits(internals.Text, Generic);
