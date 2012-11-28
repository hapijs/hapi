// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Stream = require('./stream');
var Err = require('../error');
var File = require('./file');
var Utils = require('../utils');


// Declare internals

var internals = {};


// File response  (Base -> Generic -> Stream -> Directory)

exports = module.exports = internals.Directory = function (options) {

    Utils.assert(this.constructor === internals.Directory, 'Directory must be instantiated using new');
    Utils.assert(options, 'Options must exist');
    Utils.assert(options.path, 'Options must contain a path');
    Utils.assert(!options.childPath || options.childPath.indexOf('..') === -1, 'Path traversal to a parent path is not allowed');

    if (options.childPath && options.path[options.path.length - 1] !== '/') {        // Ensure path ends with /
        options.path += '/';
    }

    this._path = options.path;
    this._childPath = options.childPath || '';
    this._index = options.index === false ? false : true;       // Defaults to true
    this._listing = options.listing === true ? true : false;    // Defaults to false

    return this;
};

NodeUtil.inherits(internals.Directory, Stream);


internals.Directory.prototype._prepare = function (callback) {

    var self = this;

    Fs.stat(self._path + self._childPath, function (err, stat) {

        if (err) {
            return self._childPath ? callback(Err.notFound('File not found')) : callback(Err.notFound('Directory not found'));
        }
        else if (!stat.isDirectory()) {
            return internals.serveFile(self._path + self._childPath, callback);
        }
        else if (!self._index && !self._listing) {
            return callback(Err.notFound('Directory not found'));
        }

        if (self._index) {
            internals.checkFileExists(self._path + 'index.html', function(indexExists) {

                if (indexExists) {
                    return internals.serveFile(self._path + 'index.html', callback);
                }
                else if (self._listing) {
                    return internals.serveListing(stat, callback);
                }
                else {
                    return callback(Err.notFound('Index file not found'));
                }
            });
        }
        else {
            return internals.serveListing(stat, callback);
        }
    });
};


internals.serveFile = function (path, callback) {

    var file = new File(path);
    return file._prepare(callback);
};


internals.serveListing = function (stat, callback) {

    console.log(stat);
};


internals.checkFileExists = function (path, callback) {

    Fs.stat(path, function (err) {

        return err ? callback(false) : callback(true);
    });
};