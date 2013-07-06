// Load modules

var Hoek = require('hoek');
var Util = require('util');


// Declare internals

var internals = {};


// Import Hoek Utilities

internals.import = function () {

    for (var i in Hoek) {
        if (Hoek.hasOwnProperty(i)) {
            exports[i] = Hoek[i];
        }
    }
};

internals.import();


// hapi version

exports.version = function () {

    return exports.loadPackage(__dirname + '/..').version;
};


exports.inherits = Util.inherits;


exports.ignore = function () { };