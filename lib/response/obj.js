// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');

// Declare internals

var internals = {};


// Obj response (Generic -> Obj)

exports = module.exports = internals.Obj = function (object) {

    Generic.call(this);
    this.variety = 'obj';

    this.source = object;                           // Can change if reference is modified
    this._flags.stringify = {};                     // JSON.stringify options

    this.replacer = this._replacer;
    this.spaces = this._spaces;
    
    this._header('content-type', 'application/json');
};

Utils.inherits(internals.Obj, Generic);


internals.Obj.prototype._prepare = function (request, callback) {

    var space = this._flags.stringify.space || request.server.settings.json.space;
    var replacer = this._flags.stringify.replacer || request.server.settings.json.replacer;
    this._payload = new Payload(JSON.stringify(this.source, replacer, space));
    return Generic.prototype._prepare.call(this, request, callback);
};
