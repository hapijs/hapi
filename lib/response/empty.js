// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Empty response (Base -> Generic -> Cacheable -> Empty)

exports = module.exports = internals.Empty = function () {

    Cacheable.call(this);
    this._tag = 'empty';

    this._payload = '';
    this._headers['Content-Length'] = 0;

    return this;
};

NodeUtil.inherits(internals.Empty, Cacheable);


