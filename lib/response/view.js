// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// View response (Generic -> View)

module.exports = internals.View = function (manager, template, context, options) {

    Generic.call(this);
    this.variety = 'view';
    this.varieties.view = true;

    this.view = {
        manager: manager,
        template: template,
        context: context,
        options: options
    };
};

Utils.inherits(internals.View, Generic);


internals.View.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    this.view.manager.render(this.view.template, this.view.context, this.view.options, function (err, rendered, config) {

        if (err) {
            return Utils.nextTick(callback)(err);
        }

        self._payload = [rendered];
        if (config.contentType) {
            self._headers['content-type'] = config.contentType;
        }

        self.encoding(config.encoding);

        return Generic.prototype._prepare.call(self, request, callback);
    });
};

