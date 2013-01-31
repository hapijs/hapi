// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// View response (Base -> Generic -> Cacheable -> View)

module.exports = internals.View = function (manager, template, context, options) {

    Cacheable.call(this);
    this._tag = 'view';

    this._view = {
        manager: manager,
        template: template,
        context: context,
        options: options
    };

    return this;
};

NodeUtil.inherits(internals.View, Cacheable);


internals.View.prototype._prepare = function (request, callback) {

    this._payload = this._view.manager.render(this._view.template, this._view.context, this._view.options);
    if (this._payload instanceof Error) {
        return callback(this._payload);
    }

    this._headers['Content-Type'] = (this._view.manager.settings.engine && this._view.manager.settings.engine['Content-Type']) || 'text/html';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);

    return Cacheable.prototype._prepare.call(this, request, callback);
};

