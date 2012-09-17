// Load modules

var Err = require('./error');
var Types = require('./types');
var Utils = require('./utils');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, config, next) {

    return internals.validateRequestElement(request, 'query', config, 'query', next);
};


// Validate payload schema

exports.payload = function (request, config, next) {

    if (!config.schema) {
        return next();
    }

    return internals.validateRequestElement(request, 'payload', config, 'schema', next);
};


internals.validateRequestElement = function (request, elementKey, config, configKey, next) {

    if (config._skipValidation) {
        return next();
    }

    var elementKeys = Object.keys(config[configKey] || {});
    var submitted = Utils.clone(request[elementKey] || {});
    var isInvalid = false;
    var errorMsg = null;
    var finalizeFns = [];
    request._renamed = {};

    for (var i in elementKeys) {
        if (elementKeys.hasOwnProperty(i)) {
            var key = elementKeys[i];
            var validators = config[configKey][key].__validators;
            for (var j in validators) {
                if (validators.hasOwnProperty(j)) {
                    var validatorName = config[configKey][key].__checks[j];

                    if (validatorName in Types.mutatorMethods) {
                        finalizeFns.push(j);
                        continue;
                    }

                    var result = Types.validate(key, config[configKey][key].type, request, validators[j], elementKey);
                    if (result === false) {
                        isInvalid = true;
                        errorMsg = key + ' = ' + request[elementKey][key];
                        break;
                    }

                    delete submitted[key];
                }
            }

            for (var l in finalizeFns) {
                var result = Types.validate(key, config[configKey][key].type, request, validators[j], elementKey);
                if (result === false) {
                    isInvalid = true;
                    errorMsg = 'error on renaming ' + key + ' = ' + request[elementKey][key];
                    break;
                }
            }
        }
    }

    delete request._renamed;

    // Handle inputs that haven't been defined in config

    var processed = Object.keys(submitted);
    if (processed.length > 0) {

        isInvalid = true;
        var plural = '';
        var verb = 'is';
        if (processed.length > 1) {

            plural = 's';
            verb = 'are';
        }

        var plural = (processed.length > 1 ? 's' : '');
        errorMsg = 'the key' + plural + ' (' + processed + ') ' + verb + ' not allowed in ' + elementKey + ' for ' + request.url;
    }

    if (isInvalid) {

        if (request.validationErrors && request.validationErrors.length > 0) {

            return next(Err.badRequest(request.validationErrors.join(".\n")));
        }
        else {

            return next(Err.badRequest('Invalid ' + elementKey + ' parameter: ' + errorMsg));
        }
    }
    else {

        return next();
    }
};

