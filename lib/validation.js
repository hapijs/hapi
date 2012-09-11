// Load modules

var Err = require('./error');
var Types = require('./types');
var Utils = require('./utils');


// Declare internals

var internals = {};


// Validate individual param

exports.param = function (key, type, req, validator, mode) {

    mode = mode || "query";
    try {
        var value = req[mode][key];
    } catch (e) {
        throw e;
    }

    // Convert value from String if necessary

    var Type = Types[type];
    var converter = Type().convert || null;
    if (typeof converter !== 'undefined' && converter !== null) {
        value = converter(value);
    }

    var result = validator(value, req[mode], key, req);
    return result;
}

// Validate query

exports.query = function (request, config, next) {

    return internals.validateRequestElement(request, "query", config, "query", next);
}


// Validate payload schema

exports.payload = function(request, config, next) {

    return internals.validateRequestElement(request, "payload", config, "schema", next);
}

exports.payloadOld = function (request, config, next) {

    var definition = config.schema;
    if (!definition || !request.payload) {
        return next();
    }

    var isInvalid = false;
    var err = '';

    // Check required variables

    for (var i in definition) {
        if (definition.hasOwnProperty(i)) {
            if (definition[i].required === true) {
                if (request.payload[i] === undefined) {
                    err = 'missing required parameter';
                    isInvalid = true;
                    break;
                }
            }
        }
    }

    if (isInvalid === false) {

        // Check each incoming variable

        for (var i in request.payload) {
            if (request.payload.hasOwnProperty(i)) {

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

                    if (request.payload[i] instanceof Array) {

                        // Check for empty array

                        if (request.payload[i].length === 0 &&
                            definition[i].empty !== true) {

                            err = 'empty array not allowed';
                            isInvalid = true;
                            break;
                        }

                        // For each array element, check type

                        for (var a = 0, al = request.payload[i].length; a < al; ++a) {
                            var message = internals.checkValue(request.payload[i][a], definition[i], false);
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
                        var result = internals.checkValue(request.payload[i], definition[i], definition[i].empty);
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
        return next(Err.badRequest('\'' + i + '\': ' + err));
    }

    return next();
};


internals.checkValue = function (value, definition, isEmptyAllowed) {

    // Check for empty value

    if (value === null ||
        value === undefined ||
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
        case 'email': isValid = true; break;            // Temporary hack until new schema validation
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

            if (time === null ||
                time.length !== 4) {

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

internals.validateRequestElement = function(request, elementKey, config, configKey, next) {

    if (config._skipValidation) {
        return next();
    }
    
    var elementKeys = Object.keys(config[configKey] || {});
    var submitted = Utils.clone(request[elementKey]);
    var isInvalid = false;
    var errorMsg = null;
    var finalizeFns = [];
    request._renamed = {};

    for (var i in elementKeys) {
        if (elementKeys.hasOwnProperty(i)) {
            var key = elementKeys[i];
            var validators = config[configKey][key]._validators;
            for (var j in validators) {
                var validatorName = config[configKey][key]._checks[j];
                
                if (validatorName in Types.mutatorMethods) {
                    finalizeFns.push(j);
                    continue;
                }

                var result = exports.param(key, config[configKey][key].type, request, validators[j], elementKey);
                if (result === false) {
                    isInvalid = true;
                    errorMsg = key + ' = ' + request[elementKey][key];
                    break;
                }

                delete submitted[key];
            }

            for (var l in finalizeFns) {
                var result = exports.param(key, config[configKey][key].type, request, validators[j], elementKey);
                if (result === false) {
                    isInvalid = true;
                    errorMsg = 'error on renaming ' + key + ' = ' + request[elementKey][key];
                    break;
                }
            }
        }
    }
    
    delete request._renamed;

    // Handle inputs that haven't been defined in query config

    var processed = Object.keys(submitted);
    if (processed.length > 0) {
        isInvalid = true;
        var plural = '';
        var verb = 'is'
        if (processed.length > 1) {
            plural = 's';
            verb = 'are';
        }

        var plural = (processed.length > 1 ? 's' : '');
        errorMsg = 'the key' + plural + ' (' + processed + ') ' + verb + ' not allowed in payload for ' + request.url;
    }

    if (isInvalid) {
        return next(Err.badRequest('Invalid payload parameter: ' + errorMsg))
    }
    else {
        return next();
    }
}

