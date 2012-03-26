

// The following functions are deprecated, need refactor:


/**
 * Getter for geo dat file
 */
Monitor.prototype.get_geocity = function(){
  if (typeof this.options.geodat !== "undefined" && this.options.geodata !== null) {
    if (path.existsSync(this.options.geodat)){
      
      // TODO: move this into a loader
      try {
        var geoip = require("geoip"); // requires 
        var City = geoip.City;
        var city = new City(this.options.geodat);
      } catch (err) {
        return null;
      }
      
      return this.options.geodat;
    }
  }
  
  return null;
}

/**
 * Geolocate an incoming request
 *
 * @param {Object} req Express request object
 * @param {Function} callback function to process the result
 * @api public
 */
Monitor.prototype.geolocate = function(req, callback) {
  var ip_address = req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress));
  var geodat = this.get_geocity();
  if (!geodat) {
    return callback("Must configure a geodat file to use Monitor.geolocate()");
  }
  
  try {
    var geoip = require("geoip"); // requires libgeoip c module
    var City = geoip.City;
    var city = new City(geodat);
  } catch (err) {
    return callback(err);
  }
  
  city.lookup(ip_address, function(err, data) {
    if (err) return callback(err);
    
    callback(null, data);
  });
}