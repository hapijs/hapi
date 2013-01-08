// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');
var Utils = require('../utils');
var Fs = require('fs');
var Path = require('path');
var Views = require('../views/');

// Declare internals

var internals = {};


// View response (Base -> Generic -> Cacheable -> View)

internals.View = function (template, context, options) {

    Cacheable.call(this);
    this._tag = 'view';
    
    this._render(template, context, options);

    return this;
};

NodeUtil.inherits(internals.View, Cacheable);


internals.View.prototype._render = function (template, context, options) {

    this._payload = module.exports.Views.render(template, context, options);
    this._headers['Content-Type'] = module.exports.Views.options.engine['Content-Type'] || 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);
    
    return this;
};


module.exports = internals.View;
module.exports.Views = Views;