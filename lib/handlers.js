// Load modules

var Utils = require('./utils');
var Joi = require('joi');


// Declare internals

var internals = {};


exports = module.exports = internals.Handlers = function (pack) {

    this.pack = pack;
    this.handlers = {};
};


internals.Handlers.prototype.add = function (name, fn, schema) {

    Utils.assert(typeof name === 'string', 'Invalid handler name');
    Utils.assert(typeof fn === 'function', 'Handler must be a function:', name);
    schema = schema || Joi.any();

    this.handlers[name] = {
        fn: fn,
        schema: schema
    };
};
