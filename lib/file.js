// Load modules

var Response = require('./response');
var Utils = require('./utils');

// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.File = function (filePath) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');

    this._fileResponse = new Response.File(filePath);
};


internals.File.prototype.handler = function () {

    var self = this;

    return function (request) {

        request.reply(self._fileResponse);
    };
};