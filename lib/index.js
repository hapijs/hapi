'use strict';

// Load modules

const Server = require('./server');


// Declare internals

const internals = {};


exports.Server = Server;


process.on('unhandledRejection', console.log);
