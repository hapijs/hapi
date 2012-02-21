# Hapi Query Validation: Evaluations & Proposal

* Author: Van Nguyen <vnguyen@walmart.com>
* Date: Wed Feb 15 2012 17:30:00 GMT-0800 (PST)

## Query Validation

This document details a proposal for Query Validation and is intended to be an initial starting point for further discussion and refinement.

## Overview of Potential Solutions
The following list of evaluated solutions is a small sampling of the infinitely many possible solutions.  They are presented in random order.

### Hardcoded
The fastest way to getting a working "shim" would probably be to hardcode type validation similar to how `Validation.validateData` & `Validation.checkValue` are set up. The function `validateData` does basic variable-level checking (existential & length checking) but later calls `checkValue` for type-level checking.  The code for handling discrete types in `checkValue` are hard-coded into the function. 

    exports.validateQuery = function(req, parameters, callback){
      // ...
      
      var isInvalid = false;
      for (var i in req.query) {
        if (req.query.hasOwnProperty(i)) {
          if (internals.checkValue(req.query[i], {type: parameters[i]}) === ""){
            isInvalid = true;
            break;
          }
        }
      }
      
      // ...
    }

The above snippet assumes that the same types will be used for Payload vs Query parameters.  Otherwise, another function, checkQueryValue, would be used. 

#### Advantages

* Fast to implement
* Centralized Code Locality (all in the same file)

#### Disadvantages

* Hardcoded, Static, Not Portable
* Duplicated Code

Hardcoded means that in the event a new type were necessary, a developer would have to be called in to modify the code (as opposed to being parametric and maybe opening up an api (on-demand or on deploy) that can update the type checking... e.g. custom Enums).

There is a potential for duplicated code since the type-checking code is not very portable (it's inputs rely on Hapi's); it also does not handle creating variables of any given type (in particular, the non-builtins like Enums).


### Factory Function

The new `validateQuery` function could be generated from another function which accepts a set of configuration data.

    var opts = {
      is_valid: {
        'string': function(){ 
          
         }
      }
    }
    
    exports.QueryValidatorFactory = function(routes, options){
      options = options || {}; // Just in case we need custom options not in routes
      
      var validateQuery = function(req, callback){
        // Do Stuff; Use routes
      }
      
      return validateQuery;
    }

This adds the unique ability to have stateful & distinct validators - use the factory to create a separate validateQuery for each use case. However, the actual value gained is questionable.


#### Advantages

* Fast to implement
* Centralized Code Locality

#### Disadvantages

* Dubious value in features gained
* Possibly unnecessary/extraneous function calls (and thus increased stack usage)
* Not Portable


### Type Registry

    var async = require("async");
    var _ = require("underscore");
    
    // Note: This code is heavily simplified and is not necessarily ideal; 
    //   but the general principle is shown.
    BaseTypes = function(options){
      options = options || {};
      
      var internal = {};
      
      this.register = function(name, baseObj){
        // TODO: disallow overwrite?
        
        // Pre-processing
        baseObject.name = function(){
          return name;
        }
        
        internal[name] = baseObj;
      }
      
      this.get = function(name){
        if (typeof internal[name] !== "undefined" && internal[name] !== null){
          return internal[name];
        } else {
          return null;
        }
      }
      
      // TODO: Recursive directory walk: load any and all pre-specified Types
    }
    
    var Types = new BaseTypes();
    
    // All validate functions should have the same structure
    //   can have optional 3rd argument for callback
    //   (for async validations, if necessary)
    //   (does not have to match this, just must be consistent)
    String.prototype.validate = function(s, options){
      // Valid string => returns null; else error string
      options = options || {};
      
      if (options.length !== null && s.length > options.length){
        return "Input string (" + s + ") is longer than the allowed length (" + options.length + ")";
      }
      
      // ...
      
      return null; // Valid String detected
    }
    
    Types.register("String", String);
    
    exports.validateParam = function(param, expectedType, callback){
      var typeObj = Types.get(expectedType);
      
      if (typeObj === null){
        callback("No such type (" + expectedType + ")");
      } else {
        if (typeof typeObj.validate === "undefined" or typeObj.validate === null){
          callback("Invalid type registered as '" + )
        } else {
          callback(typeObj.validate(param));
        }
      }
    }
    
    exports.validateQuery = function(req, parameters, callback){
      // ...
      
      var collection = _.map(req.query, function(val, key){ 
        return async.apply(internals.validateParam, key, parameters[key])
      })
      
      async.parallel(collection, callback);
    }


The Type Registry offers a number of excellent advantages: general utility, extensibility, clarity.  The most powerful advantage is that it is useful outside of Validation - you can use registered types in other parts of the code to ensure strong cross-compatibility & decoupling.  It is extensible - all types are implemented in the same process so developers can add their own types at any time.  It is also logical and intuitive - the abstraction works for every type we could support programmatically in JavaScript.

#### Advantages

* Fast to implement
* Decoupled: Useful beyond Validation
* Extensible: handles any possible use-case we need
* Abstracted/Generalized: Add new types on the fly or just for one resource

#### Disadvantages

* Extra Layer of Abstraction

In some cases, abstractions can leak in unexpected ways.  


## Proposed Solution

Of the solutions presented here, Hardcoded & Type Registry offer reasonable compromises.  The best solution depends on our specific constraints (mostly just time).  Either solution can easily be extended or modified to accommodate additional constraints.  




