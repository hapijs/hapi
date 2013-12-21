// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// View response (Generic -> View)

module.exports = internals.View = function (manager, template, context, options) {

    Generic.call(this);
    this.variety = 'view';

    this.source = {
        manager: manager,
        template: template,
        context: context,
        options: options
    };
};

Utils.inherits(internals.View, Generic);


internals.View.prototype._prepare = function (request, callback) {

    var self = this;

    this.source.manager.render(this.source.template, this.source.context, this.source.options, function (err, rendered, config) {

        if (err) {
            return Utils.nextTick(callback)(err);
        }

        self._payload = new Payload(rendered);
        if (config.contentType) {
            self._header('content-type', config.contentType);
        }

        self.encoding(config.encoding);

        return Generic.prototype._prepare.call(self, request, callback);
    });
};

