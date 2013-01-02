// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');
var Utils = require('../utils');
var Fs = require('fs');
var Path = require('path');
var Views = require('../views');

// Declare internals

var internals = {};


internals.View = function (template, context, settingsOverride) {

    Cacheable.call(this);
    this._tag = 'view';
    
    this.render(template, context, settingsOverride);

    return this;
};

NodeUtil.inherits(internals.View, Cacheable);


internals.View.prototype.render = function (template, context, optionsOverride) {

    this._payload = module.exports.Views.render(template, context);
    this._headers['Content-Type'] = 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);
    
    return this;
};

module.exports = internals.View;
module.exports.Views = new Views();