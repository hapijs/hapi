// Load modules

var Fs = require('fs');
var NodeUtil = require('util');
var Cacheable = require('./cacheable');
var Err = require('../error');
var File = require('./file');
var Utils = require('../utils');


// Declare internals

var internals = {};


// File response  (Base -> Generic -> Cacheable -> Directory)

exports = module.exports = internals.Directory = function (path, options) {

    Utils.assert(this.constructor === internals.Directory, 'Directory must be instantiated using new');
    Utils.assert(options, 'Options must exist');

    Cacheable.call(this);
    this._tag = 'cacheable';

    this._path = path;
    this._resource = options.resource;
    this._isRoot = options.isRoot;
    this._index = options.index === false ? false : true;       // Defaults to true
    this._listing = !!options.listing;                          // Defaults to false

    return this;
};

NodeUtil.inherits(internals.Directory, Cacheable);


internals.Directory.prototype._prepare = function (callback) {

    var self = this;

    if (this._path.indexOf('..') !== -1) {
        return callback(Err.forbidden());
    }

    // Lookup file

    (new File(self._path))._prepare(function (response) {

        // File loaded successfully

        if (response instanceof Error === false) {
            return callback(response);
        }

        // Not found

        if (response.code !== 403) {
            return callback(response);
        }

        // Directory

        if (!self._index &&
            !self._listing) {

            return callback(Err.forbidden());
        }

        if (!self._index) {
            return self._generateListing(callback);
        }

        (new File(self._path + '/index.html'))._prepare(function (indexResponse) {

            // File loaded successfully

            if (indexResponse instanceof Error === false) {
                return callback(indexResponse);
            }

            // Directory

            if (indexResponse.code !== 404) {
                return callback(Err.internal('index.html is a directory'));
            }

            // Not found

            if (!self._listing) {
                return callback(Err.forbidden());
            }

            return self._generateListing(callback);
        });
    });
};


internals.Directory.prototype._generateListing = function (callback) {

    var self = this;

    Fs.readdir(this._path, function (err, files) {

        if (err) {
            return callback(Err.internal('Error accessing directory'));
        }

        var display = Utils.escapeHtml(self._resource);
        var html = '<html><head><title>' + display + '</title></head><body><h1>Directory: ' + display + '</h1><ul>';

        if (!self._isRoot) {
            html += '<li><a href="../">Parent Directory</a></li>';
        }

        for (var i = 0, il = files.length; i < il; ++i) {
            html += '<li><a href="' + encodeURIComponent(files[i]) + '">' + Utils.escapeHtml(files[i]) + '</a></li>';
        }

        html += '</ul></body></html>';

        self._payload = html;
        self._headers['Content-Type'] = 'text/html';
        self._headers['Content-Length'] = Buffer.byteLength(html);

        callback(self);
    });
};

