// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');


// Declare internals

var internals = {};


// View response (Generic -> Cacheable -> View)

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
};

Utils.inherits(internals.View, Cacheable);


internals.View.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    this.view.manager.render(this.view.template, this.view.context, this.view.options, function (err, rendered, config) {

        if (err) {
            return Utils.nextTick(callback)(err);
        }

        self._payload = [rendered];
        if (config.contentType) {
            self._headers['Content-Type'] = config.contentType;
        }

        if (config.encoding) {
            self._flags.encoding = config.encoding;
        }

        return Cacheable.prototype._prepare.call(self, request, callback);
    });
};

