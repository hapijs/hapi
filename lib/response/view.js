// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');


// Declare internals

var internals = {};


// View response (Base -> Generic -> Cacheable -> View)

module.exports = internals.View = function (manager, template, context, options) {

    Cacheable.call(this);
    this.variety = 'view';
    this.varieties.view = true;

    this.view = {
        manager: manager,
        template: template,
        context: context,
        options: options
    };

    return this;
};

Utils.inherits(internals.View, Cacheable);


internals.View.prototype._prepare = function (request, callback) {

    this._wasPrepared = true;

    var rendered = this.view.manager.render(this.view.template, this.view.context, this.view.options);
    if (rendered instanceof Error) {
        return callback(rendered);
    }

    this._payload = [rendered];
    this._headers['Content-Type'] = (this.view.manager.settings.engine && this.view.manager.settings.engine['Content-Type']) || 'text/html';
    this._flags.encoding = (this.view.manager.settings.engine && this.view.manager.settings.engine.encoding) || 'utf-8';

    return Cacheable.prototype._prepare.call(this, request, callback);
};

