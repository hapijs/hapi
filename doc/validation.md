# Hapi Query Validation: Evaluations & Proposal

* Author: Van Nguyen <vnguyen@walmart.com>
* Date: Wed Feb 15 2012 17:30:00 GMT-0800 (PST)
* RE: brisbane.onjira.com/browse/BLAMMO-4

## Introduction or "Everything I Know So Far"
Walmart is embarking on the epic undertaking of modernizing our Mobile API using Node.js.  Node.js will allow us to better serve our customers through significant improvements in developer ergonomics, mobile performance, security, & testing [1]. 

Blammo is a collection of Node.js API frameworks & servers: Hapi, Joi, Ren, & Stimpy. Together, they form the building blocks we will use to replace our aging Java-based API by Sept '12. By March, Blammo will be rolled-out to transparently & seamlessly reverse proxy to the Java API. Then, by April, Blammo will be ready for new services, features, & functionality.  

Hapi, the Node.js HTTP API Server, will allow us to rapidly build API services while also reliably & performantly proxying existing services in the meantime. For the purposes of reverse proxying existing services, the task is relatively simple and appears to already be functional (but not yet deployed as of Feb '12, AFAIK). 

For the purposes of replacing the existing services, the task is mildly more complex - we are essentially creating a large-scale web/network application. Hapi is based on Express, a Node.js-ified, Sinatra-inspired web framework.  

TODO: conclusion

[1] The listed benefits come from Eran's 2/16 Blammo presentation.

## Overview of Potential Solutions
The following list of evaluated solutions is a small sampling of the infinitely many possible solutions.  They are presented in order of ascending effectiveness.

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

The above snippet assumes that the same types will be used for Payload vs Query parameters.  Otherwise, another function, checkQueryValue, 

#### Advantages

* Fast to implement
* Centralized Code Locality (all in the same file)

#### Disadvantages

* Hardcoded
* Duplicated Code
* Requires modification to accommodate changes to spec



### Factory Function

The new `validateQuery` function could be generated from another function which accepts a config object.

    exports.QueryValidatorFactory = function(routes, options){
      options = options || {}
      
      var validateQuery = function(req, callback){
        // Do Stuff; Use routes
      }
      
      return validateQuery;
    }

This adds the unique ability to have stateful & distinct validators. However, the value gained is dubious & questionable.


#### Advantages

* 

#### Disadvantages

* 

### Type Registry

    Types = function(){
      
    }

    String.prototype.is_valid 

    Types.register("String", String)

    exports.validateQuery = function(query, expectedType){
      
    }

The Type Registry offers a number of excellent advantages: general utility, extensibility, clarity.  The most powerful advantage is that it is useful outside of Validation - you can use registered types in other parts of the code to ensure strong cross-compatibility & decoupling.  It is extensible - all types are implemented in the same process so developers can add their own types at any time.  It is also logical and intuitive - 

#### Advantages

* Fast to implement
* Useful beyond Validation (decoupled)
* Extensible: handles any possible use-case we need
* Add new types on the fly or just for one resource

#### Disadvantages

* Extra Layer of Abstraction


## Proposed Solution













# DEPRECATED || Notes

## Solution Adv/Disadv Table

### Advantages
<table>
  <thead>
    <tr>
      <td>Advantages</td>
      <td>Shim</td>
      <td>Factory</td>
      <td>Type Registry</td>
    </tr>
  </thead>
</table>

### Primary Use Case
https://mobile.walmart.com/m/j?service=ExtendedItem&method=get&p1=12016269&version=2&e=1 => returns JSON object

### Design Goals
My interpretation of Hapi: Hapi is an (eventually) open-source API server designed to reverse proxy & cache requests to Walmart's Java API (mobile.walmart.com).  As such, Hapi should be fast, secure, and stable.  But be aware, my interpretation could be wrong; this document is intended to be an initial starting point for further discussion or debate.

As an intermediate, Hapi inherently adds some unavoidable latency - particularly for initial, uncached requests. This latency should be minimized as much as possible.

As a publically accessible endpoint, Hapi will be exposed to the elements.  Hapi should not be vulnerable to security exploits (e.g. improper UTF-16 handling & buffer overflows).  

The protected API may not change that often but Hapi should have some element of configurability.  It should also be highly stable - TODO: finish this intro

## Query Validation: The Problem


