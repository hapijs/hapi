// Load modules

var Boom = require('boom');
var Utils = require('./utils');
var Schema = require('./schema');
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

/*
internals.Handlers.prototype._add = function (name, fn, options, env) {

    var self = this;

    Utils.assert(typeof fn === 'function', 'fn must be a function');
    Utils.assert(typeof name === 'string', 'name must be a string');
    Utils.assert(name.match(exports.methodNameRx), 'Invalid name:', name);
    Utils.assert(!Utils.reach(this.methods, name, { functions: false }), 'Server method function name already exists');

    var options = options || {};
    var schemaError = Schema.method(options);
    Utils.assert(!schemaError, 'Invalid method options for', name, ':', schemaError);

    var settings = Utils.clone(options);
    settings.generateKey = settings.generateKey || internals.generateKey;

};
*/