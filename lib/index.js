// Load modules

var Server = require('./server');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.Server = Server;
