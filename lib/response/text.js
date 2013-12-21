// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Text response (Generic -> Text)

exports = module.exports = internals.Text = function (text, type, encoding) {

    Generic.call(this);
    this.variety = 'text';

    this.source = text;
    this._header('content-type', type || 'text/html');
    this.encoding(encoding);
};

Utils.inherits(internals.Text, Generic);


internals.Text.prototype._prepare = function (request, callback) {

    this._payload = new Payload(this.source);
    return Generic.prototype._prepare.call(this, request, callback);
};
