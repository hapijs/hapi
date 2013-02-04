# Hapi Query Validation Configuration Syntax Proposal

* Author: Van Nguyen <vnguyen@walmart.com>
* Date: Thu Aug 2 2012 12:30:00 GMT-0800 (PST)

## Table of Contents

* [Introduction](#introduction "Introduction")
    * [Example](#example "Example")
* [Type Registry](#type-registry "Type Registry")
* [Constraints](#constraints "Constraints")
    * [BaseType](#basetype "BaseType")
    * [String](#string "String")
    * [Number](#number "Number")
    * [Boolean](#boolean "Boolean")
    * [Array](#array "Array")
    * [Object](#object "Object")
* [Usage](#usage "Usage")
    * [Config Syntax](#config-syntax "Config Syntax")
    * [Evaluation Order](#evaluation-order "Evaluation Order")
* [Security Considerations](#security-considerations "Security Considerations")
* [References](#references "References")
    * [Reference A: Other Types](#reference-a-other-types "Reference A: Other Types")
    * [Reference B: Deprecated Proposal](#reference-b-deprecated-proposal "Reference B: Deprecated Proposal")
 

## Abstract

Query validation is the process of ensuring that querystring parameters given to route URI match pre-specified expectations. Thus, developers can code handlers with the explicit knowledge that any and all invalid inputs will not be passed to the handler (and thus not have to repetitively write type juggling code for each handler). 

This proposal defines the generic configuration syntax for:
* required & optional inputs
* specifying that inputs be a specific (and perhaps custom) data type
* specifying further limitations upon above specific data type
* specifying relationships between inputs

## Introduction

TODO: write this last

### Example
#### Config
    [
      { method: 'GET', path: '/users', handler: Users.get, query: query},
      ...
    ]

#### Query Config
    var S = Types.String,
        I = Types.Int;
    
    var query = {
      username: S().required().alphanum().min(3).max(30).with("email"),
      password: S().regex(/[a-zA-Z0-9]{3,30}/).without("access_token"),
      access_token: S(),
      birthyear: I().min(1850).max(2012),
      email: S().email()
    }

The above query specifies a lot of constraints:
* Inputs of any type are by default optional.
* Strings are by default utf-8 encoded.
* username is a required string, must contain only alphanumeric characters
* username is atleast 3 chars long but no more than 30
* username must be accompanied with an email (logical AND)
* password string must satisfy the custom regex (same as username: min 3, max 30, alphanum chars)
* either password or access_token must be supplied, BUT not both (logical XOR)
* access_token is an unconstrained string
* birthyear is an integer between 1850 and 2012
* email is a valid email string

The above constraints point out some non-obvious features:
* relationships are defined in an additive fashion
** "X.join(Y), Y.join(Z)" is the same as requiring all three to be present: "X AND Y AND Z"
** Likewise "X.xor(Y), Y.xor(Z)" => requires that only one of three be present: "X XOR Y XOR Z"
* .regex may or may not override other string-related constraints (.alphanum, .min, .max)
** constraints are evaluated in order 
* order of chained functions matter
** ".min(0).max(100).min(1)" sets the min to 1, overwriting the result of the first min call
** if ".regex(/[a-z]{0,3}/)" and ".max(50)" both supplied, only the overlap is valid (length 3 or less = valid)



## Type Registry

The Types object is pre-populated with a mutable list of JavaScript's valid data types. However, for convenience, the registry also includes subset helpers (marked with #):

* String
* Number
* Boolean
* Array
* Object
* Function
* Int # Number.integer()
* Float # Number.float()
* Date # String.date()
* Email # String.email()

Note that the Int is just Number with the integer constraint already applied. Any custom, user-defined data type is derived from one of the base types (although it may also combine additional types for sub-elements). Thus, there are two valid ways of creating your own types.

The first method is to add the type directly to the Type Registry. This makes the new type explicitly available as a base Type.

    var IntDef = _.extends({}, Number, function(){
      // Constructor
      return this.integer();
    });
    Types.set("Int", IntDef);
    var Int = Types.Int;

The second, simpler, and more acceptable method is to alias the new Type within the config file.

    var PositiveInt = Number().integer().min(0)
    PositiveInt.max(999999);

Thus, subsequent calls to the new "type" will behave as fully registered types in much less code.

*Note: The first method may eventually be deprecated. Then, the Type Registry becomes non-mutable which simplifies the logic significantly.*

*Note: See "Reference A" before suggesting a pre-included Type for the Type Registry.*



## Constraints

Constraints are functions that restrict the input value in some way.

### Implementation

TODO: Show example function definition (to show logical uniformity between constraints and chainability)


### By Type

#### BaseType

All types inherit the following builtin constraints:

##### BaseType.required([predicate = true])

Specifies whether or not this input is required, as determined by predicate.

If predicate is not specified, it defaults to true.

##### BaseType.optional()

Explicitly specifies that this input is optional.

Equivalent to:
    BaseType.required(false)

##### Basetype.valid(a1[, a2, ...])

Specifies an arbitrary number of valid values for this input.

If no inputs are supplied, it returns an Error.

*Note: The two functions .valid and .invalid should not be used simultaneously.*

##### Basetype.invalid(a1[, a2, ...])

Specifies an arbitrary number of invalid values for this input.

If no inputs are supplied, it returns an Error.

*Note: The two functions .valid and .invalid should not be used simultaneously.*

##### BaseType.with(a1[, a2, ...])

Specifies an arbitrary number of inputs that must also be supplied (a1..an) with this input.

*Note: This may or may not have aliases in the final version (.join, .with, .and... etc)*

##### BaseType.without(a1[, a2, ...])

Specifies an arbitrary number of inputs that cannot exist alongside this input (logical XOR).

*Note: This may or may not have aliases in the final version (.disjoin, .without, .xor... etc)*

##### BaseType.rename(to[, options])

Specifies a key to rename the current parameter to.

Options takes the form of an object with the follow default values:

    {
      deleteOrig: false,
      allowMult: false,
      allowOverwrite: false
    }

The option "deleteOrig" specifies whether or not to delete the original key of the param (effectively a permanent "move").

The option "allowMult" specifies whether or not multiple parameters can be renamed to a single key.

The option "allowOverwrite" specifies whether or not the rename function can overwrite existing keys.


#### String

Strings, by default, match JavaScript Strings. They are typically unbounded in length unless limited by interpreter. They are encoded in UTF-8 (this is true in Node.js at least). They may contain any allowable characters in the specified encoding.

The Type Registry's implementation of String also includes some builtin constraints:

##### String.min(n)

Specifies a minimum length for this input string, inclusive.

If n is not specified, it returns an Error.

If n is not a non-negative integer, it returns an Error.

##### String.max(n)

Specifies a maximum length for this input string, inclusive.

If n is not specified, it returns an Error.

If n is not a positive integer, it returns an Error.

##### String.alphanum()

Specifies that this input may only consist of alphanumeric characters.

##### String.regex(pattern)

Specifies that this input matches the given RegExp pattern.

If pattern is not specified, it returns an Error.

If pattern is not a valid RegExp object, it returns an error.

##### String.email()

Specifies that this input is a valid email string.

##### String.date()

Specifies that this input is a valid Date string.

##### String.encoding(enc)

Specifies an explicit encoding for this input string.

*Warning: This may or may not be included in the final version. A better solution may be to forcibly convert from the encoding specified by enc to utf-8. However, this is not always possible (i.e. UTF-16 converting to UTF-8 would truncate a lot of characters).*


#### Number

##### Number.integer()

Specifies that this input be a valid integer.

##### Number.float()

Specifies that this input be a valid float or double.

##### Number.min(n)

Specifies a minimum value for this input, inclusive.

If n is not specified, it returns an Error.

If n is not a positive integer, it returns an Error.

##### Number.max(n)

Specifies a maximum value for this input, inclusive.

If n is not specified, it returns an Error.

If n is not a positive integer, it returns an Error.


#### Boolean

Boolean values accept a case-insensitive string parameter. If the value is "true", true is returned. Otherwise, false is returned.

*Note: Boolean has no special methods other than those inherited from BaseType*


#### Array

Array values take the querystring form of

    ?cars=1&cars=2

and get converted to

    { cars: [ '1', '2' ] }

by the server.

*Note: Array has no special methods other than those inherited from BaseType*


#### Object

*Note: Object has no special methods other than those inherited from BaseType*


#### Function

This data type is unlikely to be used in practice. However, it exists for completeness and can be used in the definition of other Types.

*WARNING: This type uses eval. If you do not know what you are doing, using this Type is dangerous and poses numerous security risks. Use at your own peril.*

*Note: Function has no special methods other than those inherited from BaseType*



## Usage

### Config Syntax

In Hapi's routes configuration array, the routes are listed as JavaScript objects. Route objects may include an optional "query" key, the value of which should be an object. This object should associate querystring input names to validation constraints.

    var queryObj = {
      input_name: constraints
    }

In the above code example, "input_name" must conform to typical JavaScript object key constraints (no spaces, no quotes unless escaped and surrounded by quotes, etc).

In place of "constraints", there should be a combination of constraints. The combination of constraints must be formed starting from a valid base type. The base type may be followed by zero or more pre-defined constraint functions chained consecutively. These combinations can be pre-combined into "alias" variables that may also be followed by zero or more pre-defined constraint functions chained consecutively. An example is shown below:

    Base().constraint_one().constraint_two()...
    
    BaseAlias = Base().constraint()
    BaseAlias.constraint_one().constraint_two()...

Constraint functions may accept optional and arbitrary parameters. 

Every call must have its own `Base()` prefix. This creates a new validation object. Otherwise, it will retain settings from any prior constraints.

### Evaluation Order

#### Overrides

Each constraint is evaluated independently and in order of chaining. In some cases, a subsequent constraint may override a prior constraint:

    String.required().optional() # This input will be considered optional
    String.required(false).required() # This input will be considered required

Constraints that can override modify the query validation state upon the function's evocation. The actual evaluation is performed at the end of the chain (or once the entire querystring validation is finished). These constraint functions are special cases:

* required/optional
* with/without
* rename

Rename is always performed at the end of the chain.

TODO: with/without rules

#### Overrules

Yet, in another case, a prior constraint may overrule a subsequent constraint:

    Types.String().max(5).max(10) # This input cannot be larger than 5 characters
    Types.String().max(3).regex(/.{0,5}/) # This input cannot be larger than 3 characters

This should apply to all other constraints that do not override.



## Security Considerations

Encodings could potentially play a role in security - some strings in one encoding, when exec()'d in another encoding could execute malicious code. If this type of validation is enabled, it will likely provide little to no explicit protection for developers. Developers could unintentionally (and even worse, unknowingly) expose a significant security risk.



## References
### Reference A: Other Types

#### "null"

The "null" variable is considered to be of type "object". An alias could easily be added for this type if necessary. However, for the purposes of querystring validation, this appears to be unnecessary.

#### "undefined"

Unlike null, undefined is its own type with its own special properties. For the purposes of querystring validation, any blank or indefinite inputs will appear as blank strings (""). As far as I know, there is no way to force the undefined object into the querystring. Thus, unless otherwise proven, "undefined" will not be included in the Type Registry.


### Reference B: Deprecated Proposal
    ## Some Approaches

    * Objects
    * Objects w/ helpers
    * DSL

    Example Route/Endpoint Config:

        { method: 'GET',    path: '/contacts',                      handler: User.contacts,         query: ['exclude'], tos: 'none' }

    ### Design Considerations

    TODO

    ### Objects

        query: {"email": {type: "String"}} // use defaults
        query: {"username": {type: "String", required: false}} // optional parameter
        query: {"password": {type: "String", min: 6}} // override settings
        query: {"email": {type: "String"}, "password": {type: "String"}} // multiple params
        
        // relationships
        query: {"CreditCardNumber": {type: "String", "AND": ["Name", "Expiration", "Code"]}, "Name": {type: "String", "AND": ["CreditCardNumber", "Expiration", "Code"]}, "Expiration": {type: "String", "AND": ["Name", "CreditCardNumber", "Code"]}, "Code": {type: "String", "AND": ["Name", "Expiration", "CreditCardNumber"]}} // all or nothing
        query: {"access_token": {type: "String", "XOR": ["password"]}, "password": {type: "String", "XOR": ["access_token"]}} // XOR

    * Straightforward, no-nonsense approach: just the data
    * Fairly performant
    * Easily understood by devs
    * Can become quite verbose

    ### Objects w/ helpers functions

        // T = Types.ensure
        query: {"email": T("String")}
        query: {"username": T("String", {required: false})} 
        query: {"password": T("String", {min: 6})}
        query: {"email": T("String"), "password": T("String")} // multiple params
        
        // relationship
        var CC_GRP = ["CreditCardNumber", "Name", "Expiration", "Code"];
        query: {CreditCardNumber: T("String").with(CC_GRP), Name: T("String").with(CC_GRP), Expiration: T("String").with(CC_GRP), Code: T("String").with(CC_GRP)} // all or nothing
        query: {access_token: T("String").xor("password"), password: T("String").xor("access_token")} // XOR

    * T() returns Object from "Object" section
    * Dubious added value unless pre-executed to form new endpoint/routes before server start
    * Similar style used by rackspace's swiz

    ### DSL

        query: ["String#email"] // uses defaults
        query: ["String#username?"] // optional param
        query: ["String#password.min(6)"] // modify params
        query: ["String#email", "String#password"] // multiple params
        
        // relationships
        query: ["String#CreditCardNumber < String#Name + Datetime#Expiration + String#Code"] // all or nothing
        query: ["String#access_token | String#password"] // XOR
        query: ["String#a.group(items) + String#b.group(items) + String#c.group(items)"] // Generalized grouping

    * Lowest average verbosity
    * Human-readable
    * Requires additional processing/cpu cycles to parse, could be pre-processed like Obj w/ helpers fn for performance



