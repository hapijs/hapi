# Style & Best Practices

## Comments



## Nesting Anti-pattern
Async function nesting is most annoying after you start nesting 3+ functions deep. One to two functions may be acceptable for brevity, but that threshold is arbitrary and we can decide later.  Upon surpassing the threshold, I suggest using the caolan/async library to make life easier and reduce nesting & code duplication.

`
  internals.authenticate(req, res, config, server, function(err, result){
    if (err === null){
      Validation.validateQuery(req, config.query ? Utils.map(config.query) : null, function (err) {
        if (err === null){
          ....
        } else {
          res.hapi.error = err;
          next();
        }
      });
    } else {
      res.hapi.error = err;
      next();
    }
  })
`
versus
`
  var async = require("async");
  async.waterfall([
    function(callback){ callback(null, req, res, config, server) }, // populate initial state
    internals.authenticate, // Last function argument must be callback function of form:  cb(err, result1...) where '...' is a splat
    Validation.validateQuery, // Same callback style constraint as above // May need to tweak this to process proper variables though...
    // ...
  ], function(err, result) ->
    // This final callback function is called in two cases:
    //    1) successful completion
    //    2) breaks on error, if internals.authenticate did callback("some error"), Validation.validateQuery would not be called
    if (err === null){
      // do stuff
    } else {
      // Only one error condition needs to be specified per execution chain
      res.hapi.error = err;
      next();
    }
  )
`

The latter is very concise if you remove comments.  


## Object Orientation Programming
### Public vs Private methods
I'm sure you are aware of this convention.  
`
  var MyClass = function(){
    // Private Method
    var foo = function(){};

    return {
      // Public Data
      defaults: {},

      // Public Method
      initialize: function(){
        foo();
      }
    };
  };

  var mc = new MyClass();
  // mc.foo // undefined
  mc.initialize() // calls foo()
`

### Inheritance
`

`

## Google Closure Compiler 
Perhaps for later... but GCC is a good tool for identifying code that never gets used (optimization part of GCC can be replaced by uglify for similar if not equal performance IIRC).