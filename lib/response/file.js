// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Stream = require('./stream');


// Declare internals

var internals = {};


// File response

exports = module.exports = internals.File = function (filePath) {

    var stream = Fs.createReadStream(filePath);
    Stream.call(this, stream);
    this._tag = 'file';

    return this;
};

NodeUtil.inherits(internals.File, Stream);

