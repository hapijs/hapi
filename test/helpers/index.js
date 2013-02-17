// Load modules

var Events = require('events');
var Hapi = require('../../lib');


// Declare internals

var internals = {};


module.exports = Hapi;


internals.Logger = function () {

    Events.EventEmitter.call(this);

    return this;
};

Hapi.utils.inherits(internals.Logger, Events.EventEmitter);
module.exports._TEST = internals.logger = new internals.Logger();


// Override Log's console method

Hapi.log.console = function (message) {

    internals.logger.emit('log', message);
};