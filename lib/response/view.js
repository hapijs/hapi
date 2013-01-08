// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// View response (Base -> Generic -> Cacheable -> View)

module.exports = internals.View = function (manager, template, context, options) {

    Cacheable.call(this);
    this._tag = 'view';

    this._payload = manager.render(template, context, options);
    this._headers['Content-Type'] = manager.settings.engine['Content-Type'] || 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);

    return this;
};

NodeUtil.inherits(internals.View, Cacheable);


