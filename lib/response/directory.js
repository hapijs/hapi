// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Text = require('./text');
var Err = require('../error');
var File = require('./file');
var Utils = require('../utils');


// Declare internals

var internals = {
    htmlStart: '<html><head><title>Directory listing</title></head><body><ul>',
    htmlEnd: '</ul></body></html>'
};


// File response  (Base -> Generic -> Cacheable -> Text -> Directory)

exports = module.exports = internals.Directory = function (options) {

    Utils.assert(this.constructor === internals.Directory, 'Directory must be instantiated using new');
    Utils.assert(options, 'Options must exist');
    Utils.assert(options.path, 'Options must contain a path');
    Utils.assert(!options.childPath || options.childPath.indexOf('..') === -1, 'Path traversal to a parent path is not allowed');

    if (options.childPath && options.path[options.path.length - 1] !== '/') {        // Ensure path ends with /
        options.path += '/';
    }

    this._path = options.path;
    this._routePath = options.routePath;
    this._childPath = options.childPath || '';
    this._index = options.index === false ? false : true;       // Defaults to true
    this._listing = options.listing === true ? true : false;    // Defaults to false

    return this;
};

NodeUtil.inherits(internals.Directory, Text);


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
                    return self._serveListing(callback);
                }
                else {
                    return callback(Err.notFound('Index file not found'));
                }
            });
        }
        else {
            return self._serveListing(callback);
        }
    });
};


internals.Directory.prototype._serveListing = function (callback) {

    var self = this;
    Fs.readdir(self._path + self._childPath, function (err, files) {

        if (err) {
            return callback(Err.internal('Error accessing directory'));
        }

        var html = internals.htmlStart;

        if (self._childPath) {
            html += internals.htmlParentPath(self._routePath);
        }

        for (var i = 0, il = files.length; i < il; ++i) {
            html += internals.htmlFile(self._routePath, files[i]);
        }

        html += internals.htmlEnd;

        Text.call(self, html);
        callback(self);
    });
};

internals.serveFile = function (path, callback) {

    var file = new File(path);
    return file._prepare(callback);
};


internals.checkFileExists = function (path, callback) {

    Fs.stat(path, function (err) {

        return err ? callback(false) : callback(true);
    });
};


internals.htmlParentPath = function (routePath) {

    var pathArr = routePath.split('/');
    pathArr.shift();
    pathArr.pop();

    return '<li><a href="/' + pathArr.join('/')  + '">Parent Directory</a></li>';
};


internals.htmlFile = function (routePath, file) {

    if (routePath[routePath.length - 1] !== '/') {        // Ensure path ends with /
        routePath += '/';
    }

    return '<li><a href="' + routePath  + file + '">' + file + '</a></li>';
};