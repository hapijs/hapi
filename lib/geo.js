/**
 * Module dependencies.
 */
var geoip = require("geoip"); // This requires installing various third-party tools
var City = geoip.City;
var Utils = require("./utils");

/**
 *
 */
function Geo(options){
  this.options = Utils.merge({}, this._options, options || {});
  
  // TODO: preload any configured data files
  
  return this;
}

/**
 *
 */
Geo.prototype._options = {
  geodata: {}, // Geodata file for use by geoip
}

/**
 *
 */
Geo.prototype.lookupCity = function(ip, callback){
  if (typeof this.options.geodata.city === "undefined" || this.options.geodata.city == null){
    return callback("options.geodata was not specified.");
  }
  
  var city = new City(this.options.geodata.city);
  city.lookup(ip_address, function(err, data) {
    if (err) return callback(err);
    
    callback(null, data);
  });
}

/**
 * 
 */
module.exports = exports = new Geo();

/**
 *
 */
exports.Geo = Geo;



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