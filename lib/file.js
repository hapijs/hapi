// Load modules

var Response = require('./response');
var Utils = require('./utils');

// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.File = function (routePath, filePath) {

    Utils.assert(this.constructor === internals.File, 'File must be instantiated using new');
    Utils.assert((typeof filePath === 'function') || (routePath.indexOf('{') === -1), 'Route path cannot contain a parameter');         // String paths cannot contain parameters in route

    this._filePath = filePath;
};


internals.File.prototype.handler = function() {

    var self = this;
    var fileResponse = null;

    if (typeof this._filePath === 'function') {
        return function(request) {

            var filePath = self._filePath(request);
            fileResponse = new Response.File(filePath);

            request.reply(fileResponse);
        };
    }
    else {
        fileResponse = new Response.File(this._filePath);

        return function(request) {

            request.reply(fileResponse);
        };
    }
};