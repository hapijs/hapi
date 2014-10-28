// Load modules

var Boom = require('boom');
var Glue = require('glue');
var Statehood = require('statehood');
var Pack = require('./pack');
var Server = require('./server');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.error = exports.Error = exports.boom = exports.Boom = Boom;
exports.Server = Server;
exports.Pack = Pack;
exports.Pack.compose = Glue.compose;


exports.state = {
    prepareValue: Statehood.prepareValue
};

exports.createServer = function () {

    return new exports.Server(arguments[0], arguments[1], arguments[2]);
};
