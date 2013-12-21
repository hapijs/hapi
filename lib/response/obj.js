// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');

// Declare internals

var internals = {};


// Obj response (Generic -> Obj)

exports = module.exports = internals.Obj = function (object, options) {

    Generic.call(this);
    this.variety = 'obj';

    this.source = object;                           // Can change if reference is modified
    this._stringify = {};                           // JSON.stringify options
    this.options(options);
};

Utils.inherits(internals.Obj, Generic);


internals.Obj.prototype.options = function (options) {

    options = options || {};

    if (options.hasOwnProperty('replacer')) {
        this._stringify.replacer = options.replacer;
    }

    if (options.hasOwnProperty('space')) {
        this._stringify.space = options.space;
    }

    this._header('content-type', options.type || this._headers['content-type'] || 'application/json');
    this.encoding(options.encoding);
};


internals.Obj.prototype._prepare = function (request, callback) {

    var space = this._stringify.space || request.server.settings.json.space;
    var replacer = this._stringify.replacer || request.server.settings.json.replacer;
    this._payload = new Payload(JSON.stringify(this.source, replacer, space));
    return Generic.prototype._prepare.call(this, request, callback);
};
