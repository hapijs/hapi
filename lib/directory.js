// Load modules

var Response = require('./response');
var Utils = require('./utils');

// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Directory = function (routePath, options) {

    Utils.assert(this.constructor === internals.Directory, 'Directory must be instantiated using new');
    Utils.assert(options, 'Options must exist');
    Utils.assert(typeof options === 'object' && options.path, 'Options must be an object with a path');

    if (typeof options.path !== 'function') {
        Utils.assert(routePath[routePath.length - 1] === '}', 'The route path must contain a parameter');
    }

    this._path = options.path;
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
                listing: self._listing,
                requestPath: request.path
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
                childPath: request.params[Object.keys(request.params)[0]],
                requestPath: request.path
            });

            request.reply(response);
        };
    }
};