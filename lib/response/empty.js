// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Empty response (Base -> Generic -> Cacheable -> Empty)

exports = module.exports = internals.Empty = function () {

    Cacheable.call(this);
    this.variety = 'empty';
    this.varieties.empty = true;

    return this;
};

NodeUtil.inherits(internals.Empty, Cacheable);


