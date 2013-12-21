// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Empty response (Generic -> Empty)

exports = module.exports = internals.Empty = function () {

    Generic.call(this);
    this.variety = 'empty';
};

Utils.inherits(internals.Empty, Generic);


internals.Empty.prototype._prepare = function (request, callback) {

    this._payload = new Payload();
    return Generic.prototype._prepare.call(this, request, callback);
};
