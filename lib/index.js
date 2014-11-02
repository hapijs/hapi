// Load modules

var Boom = require('boom');
var Glue = require('glue');
var Hoek = require('hoek');
var Statehood = require('statehood');
var Server = require('./server');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.Server = Server;
exports.Server.compose = Glue.compose(exports);


exports.state = {
    prepareValue: Statehood.prepareValue
};
