/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Validator = require('validator');
var Crypto = require('crypto');
var Email = require('emailjs');
var Base64 = require('./base64');
var Log = require('./log');
var Config = require('./config');


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
};


// Check if a valid email address

exports.checkEmail = function (email) {

    try {

        Validator.check(email).len(6, 64).isEmail();
    }
    catch (e) {

        return false;
    }

    return true;
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

    var result = [];

    for (var i = 0; i < size; ++i) {

        result[i] = randomSource[Math.floor(Math.random() * len)];
    }

    return result.join('');
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


// Send email

exports.email = function (to, subject, text, html, callback) {

    var headers = {

        from: Config.settings.email.fromName + ' <' + Config.settings.email.replyTo + '>',
        to: to,
        subject: subject,
        text: text
    };

    var message = Email.message.create(headers);

    if (html) {

        message.attach_alternative(html);
    }

    var mailer = Email.server.connect(Config.settings.email.server);
    mailer.send(message, function (err, message) {

        if (err === null ||
            err === undefined) {

            if (callback) {

                callback(null);
            }
        }
        else {

            if (callback) {

                callback(Err.internal('Failed sending email: ' + JSON.stringify(err)));
            }
            else {

                Log.err('Email error: ' + JSON.stringify(err));
            }
        }
    });
};
