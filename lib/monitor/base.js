var Base = {};

Base.expose = function(self, obj, keys){
  keys = keys || null;
  
  for(var i in obj){
    if (obj.hasOwnProperty(i)){
      if (keys instanceof Array && keys.indexOf(i) < 0){
        continue;
      }
      
      self.prototype[i] = (function(fn){
        return function(callback){
          var err = null,
              result = null;
          
          
          try {
            result = fn();
          } catch (err) {
            // do nothing
            result = null;
            // err = err; // remove or keep? TODO
          }
          
          callback(err, result);
        };
      })(obj[i]);
    }
  }
};

module.exports = exports = Base;