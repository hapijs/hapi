// Load modules

var Response = require('./response');
var Utils = require('./utils');

// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Directory = function (options) {

    Utils.assert(this.constructor === internals.Directory, 'Directory must be instantiated using new');

    Utils.assert(options, 'Options must exist');

    if (typeof options === 'object') {
        Utils.assert(options.path, 'Options must contain a path');

        this._path = options.path;
    }
    else {
        this._path = options;
    }

    this._index = options.index === false ? false : true;       // Defaults to true
    this._listing = options.listing === true ? true : false;    // Defaults to false

    return this;
};


internals.Directory.prototype.handler = function () {

    var self = this;
    var response = null;

    if (typeof this._path === 'function') {
        return function (request) {

            var path = self._path(request);
            response = new Response.Directory({
                path: path,
                index: self._index,
                listing: self._listing
            });

            request.reply(response);
        };
    }
    else {
        return function (request) {

            response = new Response.Directory({
                path: self._path,
                index: self._index,
                listing: self._listing,
                childPath: request.params.path
            });

            request.reply(response);
        };
    }
};