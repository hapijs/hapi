// Load modules

var Glue = require('glue');
var Server = require('./server');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.Server = Server;
exports.Server.compose = Glue.compose(exports);
