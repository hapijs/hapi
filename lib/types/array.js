var sys = require("sys");
var util = require('util');
var BaseType = require('./base');

function ArrayType() {

    ArrayType.super_.call(this);
}

util.inherits(ArrayType, BaseType);

ArrayType.prototype.__name = 'Array';

ArrayType.prototype.convert = function(value) {

    if (!BaseType.prototype.exists(value)) {

        return [];
    }

    if (typeof value === 'string') {

        // No need to try/catch, `Invalid JSON Body` exception already handled elsehwere
        var converted = JSON.parse(value);
        if (converted instanceof Array) {

            return converted;
        }
        else {

            return [converted];
        }
    }
    else if (value instanceof Array) {

        return value;
    }
    else {

        // Defensive programming
        throw "Invalid data type passed to Types.Array (" + value + ", " + typeof value + " is not supported)";
    }
}

ArrayType.prototype._base = function() {

    return function(value) {

        return (value == null || value instanceof Array);
    };
}

ArrayType.prototype.base = function() {

    this.add('base', this._base(), arguments);
    return this;
}

ArrayType.prototype._includes = function() {

    var subElement = (new ArrayType.super_()).getDataKey();
    var args = Array.prototype.slice.call(arguments);
    var allowedTypes = args.map(function(d) {

        return d[subElement];
    });
    
    return function(values, qs, key, req) {

        // For each allowed Type
        var valueIsValid = false;
        var intermediateInvalidValues = [];
        var invalidValues = [];
        for(var i = 0; i < allowedTypes.length; i++) {

            // For each validator specified
            var validators = allowedTypes[i];
            var validatorIsValid = true;
            for(var j = 0; j < validators.length; j++) {

                // For each input supplied
                for(var m = 0; m < values.length; m++) {

                    var value = values[m];
                    var result = validators[j](value, qs, key, req);
                    console.log("success for", key, value, args[0].type, args[0]._checks[j]);
                    if (result === false) {

                        validatorIsValid = false;
                        intermediateInvalidValues.push(value);
                        console.log("failed for", key, value, args[0]._checks[j]);
                    }
                }
            }
            
            // Only need one validator to be true
            if (validatorIsValid === true) {

                valueIsValid = true;
                intermediateInvalidValues.length = 0; // empty the array
            }
            else {
                if (args[0]._checks.indexOf("includes") < 0) {

                    invalidValues = Array.prototype.concat(invalidValues, intermediateInvalidValues);
                }
            }
        }
        
        // Only append error if the included types' validators return errors

        if (valueIsValid === false && args[0]._checks.indexOf("includes") < 0) {

            req.addValidationError("the value(s) `" + invalidValues + "` in array `" + key + "` must be of type " + args[0].type)
        }
        return valueIsValid;
    }
}

ArrayType.prototype.includes = function(){

    this.add('includes', this._includes.apply(this._includes, arguments), arguments);
    return this;
}

ArrayType.prototype._excludes = function() {

    var self = this;
    var args = arguments;
    
    return function(value, qs, key, req) {
        
        var result = !self._includes.apply(self._includes, args)(value, qs, key, req);
        if (result === false) {

            var variablePattern = /[`]\S+[`]/g;
            var typePattern = /(\S+)$/;
            for(var i = 0; i < req.validationErrors.length; i++) {

                var varMatches = req.validationErrors[i].match(variablePattern);
                var typeMatch = req.validationErrors[i].match(typePattern)[0];
                req.validationErrors[i] = "the value(s) " + varMatches[0] + " in array " + varMatches[1] + " must not be " + typeMatch;
            }
        }
        return result;
    }
}

ArrayType.prototype.excludes = function(){

    this.add('excludes', this._excludes.apply(this, arguments), arguments);
    return this;
}

function CreateType() {

    return new ArrayType();
}

module.exports = CreateType;
module.exports.ArrayType = ArrayType;