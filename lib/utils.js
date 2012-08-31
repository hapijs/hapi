/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Fs = require('fs');
var Crypto = require('crypto');
var Async = require('async');
var Err = require('./error');
var Base64 = require('./base64');
var Log = require('./log');


// Get current date/time msec count

exports.getTimestamp = function () {

    return (new Date()).getTime();
};


// Clone object or array

exports.clone = function (obj) {

    if (obj === null ||
        obj === undefined) {

        return null;
    }

    var newObj = (obj instanceof Array) ? [] : {};

    for (var i in obj) {

        if (obj.hasOwnProperty(i)) {

            if (obj[i] && typeof obj[i] === 'object') {

                newObj[i] = exports.clone(obj[i]);
            }
            else {

                newObj[i] = obj[i];
            }
        }
    }

    return newObj;
};


// Merge all the properties of source into target, source wins in conflic, and by default null and undefined from source are applied

exports.merge = function (target, source, isNullOverride) {

    if (source) {

        target = target || (source instanceof Array ? [] : {});

        for (var key in source) {

            if (source.hasOwnProperty(key)) {

                var value = source[key];

                if (value &&
                    typeof value === 'object') {

                    if (value instanceof Date) {

                        target[key] = new Date(value.getTime());
                    }
                    else if (value instanceof RegExp) {

                        var flags = '' + (value.global ? 'g' : '') + (value.ignoreCase ? 'i' : '') + (value.multiline ? 'm' : '') + (value.sticky ? 'y' : '');
                        target[key] = new RegExp(value.source, flags);
                    }
                    else {

                        target[key] = target[key] || (value instanceof Array ? [] : {});
                        exports.merge(target[key], source[key], isNullOverride);
                    }
                }
                else {

                    if ((value !== null && value !== undefined) ||          // Explicit to preserve empty strings
                        isNullOverride !== false) {

                        target[key] = value;
                    }
                }
            }
        }
    }

    return target;
};


// Apply options to a copy of the defaults

exports.applyToDefaults = function (defaults, options) {

    var copy = exports.clone(defaults);
    return exports.merge(copy, options, false);
};


// Remove duplicate items from array

exports.unique = function (array, key) {

    var index = {};
    var result = [];

    for (var i = 0, il = array.length; i < il; ++i) {

        if (index[array[i][key]] !== true) {

            result.push(array[i]);
            index[array[i][key]] = true;
        }
    }

    return result;
};


// Convert array into object

exports.map = function (array, key) {

    if (array) {

        var obj = {};
        for (var i = 0, il = array.length; i < il; ++i) {

            if (key) {

                if (array[i][key]) {

                    obj[array[i][key]] = true;
                }
            }
            else {

                obj[array[i]] = true;
            }
        }

        return obj;
    }
    else {

        return null;
    }
};


// Flatten array

exports.flatten = function (array, target) {

    var result = target || [];

    for (var i = 0, il = array.length; i < il; ++i) {

        if (Array.isArray(array[i])) {

            exports.flatten(array[i], result);
        }
        else {

            result.push(array[i]);
        }
    }

    return result;
};


// Remove hidden keys

exports.hide = function (object, definition) {

    for (var i in definition) {

        if (definition.hasOwnProperty(i)) {

            if (definition[i].hide &&
                definition[i].hide === true) {

                delete object[i];
            }
        }
    }
};


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;
    size = size || 10;
    
    if (typeof size === 'number' && !isNaN(size) && size >= 0 && (parseFloat(size) === parseInt(size))) {

        var result = [];

        for (var i = 0; i < size; ++i) {

            result[i] = randomSource[Math.floor(Math.random() * len)];
        }

        return result.join('');
    
    }
    else {

        return null;
    }
};


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, input_encoding = 'utf8', output_encoding = 'binary');
    enc += cipher.final(output_encoding = 'binary');

    var result = Base64.encode(enc).replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = Base64.decode(value.replace(/-/g, '+').replace(/:/g, '/'));

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, input_encoding = 'binary', output_encoding = 'utf8');
    dec += decipher.final(output_encoding = 'utf8');

    var envelope = null;

    try {

        envelope = JSON.parse(dec);
    }
    catch (e) {

        Log.err('Invalid encrypted envelope: ' + dec + ' / Exception: ' + JSON.stringify(e));
    }

    return envelope ? envelope.v : null;
};


// Inherits a selected set of methods from an object, converting synchronous functions
// to asynchronous and properly handling errors

exports.inheritAsync = function (self, obj, keys) {

    keys = keys || null;

    for (var i in obj) {

        if (obj.hasOwnProperty(i)) {

            if (keys instanceof Array &&
                keys.indexOf(i) < 0) {

                continue;
            }

            self.prototype[i] = (function (fn) {

                return function (callback) {

                    var err = null;
                    result = null;

                    try {

                        result = fn();
                    }
                    catch (err) {

                        // do nothing
                        result = null;
                        // err = err; // remove or keep? TODO
                    }

                    callback(err, result);
                };
            })(obj[i]);
        }
    }
};


exports.abort = function (message) {

    if (process.env.NODE_ENV == "test") {

        throw message || "aborting with unspecified error message";
    } else {

        console.log('ERROR: ' + message);       // Must not use Log
        process.exit(1);
    }
};


exports.assert = function (condition, message) {

    if (!condition) {

        exports.abort(message);
    }
};


exports.executeRequestHandlers = function (handlers, request, callback) {

    callback = callback || function () {};

    if (handlers) {

        var list = (handlers instanceof Array ? handlers : [handlers]);
        Async.forEachSeries(list, function (func, next) {

            func(request, next);

        }, function (err) {

            callback(err);
        });
    }
    else {

        callback();
    }
};


exports.loadDirModules = function (path, excludeFiles, target) {      // target(filename, name, capName)

    var exclude = {};
    for (var i = 0, il = excludeFiles.length; i < il; ++i) {

        exclude[excludeFiles[i] + '.js'] = true;
    }

    Fs.readdirSync(path).forEach(function (filename) {

        if (/\.js$/.test(filename) &&
            !exclude[filename]) {

            var name = filename.substr(0, filename.lastIndexOf('.'));
            var capName = name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();

            if (typeof target !== 'function') {

                target[capName] = require(path + '/' + name);
            }
            else {

                target(path + '/' + name, name, capName);
            }
        }
    });
};


exports.rename = function (obj, from, to) {

    obj[to] = obj[from];
    delete obj[from];
};


exports.Timer = function () {

    this.reset();
};


exports.Timer.prototype.reset = function () {

    this.ts = exports.getTimestamp();
};


exports.Timer.prototype.elapsed = function () {

    return exports.getTimestamp() - this.ts;
};


