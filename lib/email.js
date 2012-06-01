/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Validator = require('validator');
var Email = require('emailjs');
var Err = require("./error");


// Declare internals

var internals = {};


// Check if a valid email address

exports.checkAddress = function (email) {

    try {

        Validator.check(email).len(6, 64).isEmail();
    }
    catch (e) {

        return false;
    }

    return true;
};


// Send email

exports.send = function (to, subject, text, html, options, callback) {

    var headers = {

        from: (options.fromName || 'Postmaster') + ' <' + (options.replyTo || 'no-reply@localhost') + '>',
        to: to,
        subject: subject,
        text: text
    };

    var message = Email.message.create(headers);

    if (html) {

        message.attach_alternative(html);
    }

    var mailer = Email.server.connect(options.server || {});
    mailer.send(message, function (err, message) {

        if (callback) {

            callback(err ? Err.internal('Failed sending email: ' + JSON.stringify(err)) : null);
        }
    });
};





