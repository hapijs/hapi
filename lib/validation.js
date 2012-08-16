/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Utils = require('./utils');
var Err = require('./error');
var Types = require('./types');


// Declare internals

var internals = {};


// Validate query

exports.validateQuery = function(req, parameters, callback){
    var params = Object.keys(parameters);
    var isInvalid = false;
    
    for(var i in params){
        var key = params[i];
        var validators = parameters[key]._validators;
        
        for(var j in validators){
            var value = req.hapi.query[key];
            
            // Convert value from String if necessary
            var Type = Types[parameters[key].type]
            var converter = Type().convert || null;
            if (typeof converter !== "undefined" && converter !== null){
                value = converter(value);
            }
            
            var result = validators[j](value, req.hapi.query);
            // console.log("validator #" + i + "." + j, value, typeof value, result)
            if (result === false){
                isInvalid = true;
                // break;
            }
        }
    }
    
    if (isInvalid) {

        callback(Err.badRequest('Unknown parameter: ' + i));
    }
    else {

        callback(null);
    }
}

exports.validateQueryOld = function (req, parameters, callback) {

    if (parameters === null) {

        return callback(null);
    }

    var isInvalid = false;
    for (var i in req.query) {

        if (req.query.hasOwnProperty(i)) {

            if (parameters[i] !== true) {

                isInvalid = true;
                break;
            }
        }
    }

    if (isInvalid) {

        callback(Err.badRequest('Unknown parameter: ' + i));
    }
    else {

        callback(null);
    }
};


// Validate payload schema

exports.validateData = function (req, definition, callback) {

    if (definition === null) {

        return callback(null);
    }

    var isInvalid = false;
    var err = '';

    // Check required variables

    for (var i in definition) {

        if (definition.hasOwnProperty(i)) {

            if (definition[i].required === true) {

                if (req.hapi.payload[i] === undefined) {

                    err = 'missing required parameter';
                    isInvalid = true;
                    break;
                }
            }
        }
    }

    if (isInvalid === false) {

        // Check each incoming variable

        for (var i in req.hapi.payload) {

            if (req.hapi.payload.hasOwnProperty(i)) {

                // Lookup variable definition

                if (definition[i] === undefined) {

                    err = 'unknown parameter';
                    isInvalid = true;
                    break;
                }

                // Check if update allowed

                if (definition[i].set === false) {

                    err = 'forbidden parameter';
                    isInvalid = true;
                    break;
                }

                // Check for array type

                if (definition[i].array === true) {

                    // If variable is an array

                    if (req.hapi.payload[i] instanceof Array) {

                        // Check for empty array

                        if (req.hapi.payload[i].length === 0 &&
                            definition[i].empty !== true) {

                            err = 'empty array not allowed';
                            isInvalid = true;
                            break;
                        }

                        // For each array element, check type

                        for (var a = 0, al = req.hapi.payload[i].length; a < al; ++a) {

                            var message = internals.checkValue(req.hapi.payload[i][a], definition[i], false);
                            if (message) {

                                err = 'invalid array value - ' + message;
                                isInvalid = true;
                                break;
                            }
                        }

                        // Double break

                        if (isInvalid === true) {

                            break;
                        }
                    }
                    else {

                        err = 'array value required';
                        isInvalid = true;
                        break;
                    }
                }
                else {

                    if (definition[i].type !== 'any') {

                        var result = internals.checkValue(req.hapi.payload[i], definition[i], definition[i].empty);
                        if (result) {

                            err = result;
                            isInvalid = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    if (isInvalid) {

        callback(Err.badRequest('\'' + i + '\': ' + err));
    }
    else {

        callback(null);
    }
};


internals.checkValue = function (value, definition, isEmptyAllowed) {

    // Check for empty value

    if (value === null ||
        (typeof value === 'number' && isNaN(value)) ||
        (typeof value === 'string' && value === '')) {

        if (isEmptyAllowed !== true) {

            return 'empty value not allowed';
        }
        else {

            return '';
        }
    }

    // Check types

    var isValid = false;

    switch (definition.type) {

        case 'string': isValid = (typeof value === 'string'); break;
        case 'id': isValid = (typeof value === 'string'); break;
        case 'number': isValid = (typeof value === 'number'); break;
        case 'enum': isValid = (typeof value === 'string' && definition.values && definition.values[value] > 0); break;
        case 'object': isValid = (typeof value === 'object'); break;
        case 'email': isValid = Utils.checkEmail(value); break;
        case 'date':

            if (typeof value !== 'string') {

                return 'value must be a string';
            }

            var dateRegex = /^([12]\d\d\d)-([01]\d)-([0123]\d)$/;
            var date = dateRegex.exec(value);

            if (date === null || date.length !== 4) {

                return 'invalid date string format';
            }

            var year = parseInt(date[1], 10);
            var month = parseInt(date[2], 10);
            var day = parseInt(date[3], 10);

            if (year < 1970 || year > 3000) {

                return 'invalid year: ' + date[1];
            }

            if (month < 1 || month > 12) {

                return 'invalid month: ' + date[2];
            }

            if (day < 1 || day > 31) {

                return 'invalid day: ' + date[3];
            }

            isValid = true;
            break;

        case 'time':

            if (typeof value !== 'string') {

                return 'value must be a string';
            }

            var timeRegex = /^([012]\d):([012345]\d):([012345]\d)$/;
            var time = timeRegex.exec(value);

            if (time === null || time.length !== 4) {

                return 'invalid time string format';
            }

            var hour = parseInt(time[1], 10);
            var minute = parseInt(time[2], 10);
            var second = parseInt(time[3], 10);

            if (hour < 0 || hour > 23) {

                return 'invalid hour';
            }

            if (minute < 0 || minute > 59) {

                return 'invalid minute';
            }

            if (second < 0 || second > 59) {

                return 'invalid second';
            }

            isValid = true;
            break;
    }

    return (isValid ? '' : 'bad value type, ' + definition.type + ' expected');
};

