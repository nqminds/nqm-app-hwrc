
module.exports = (function() {
  "use strict";
  
  var log = require("debug")("hwrc-rcLookup");
  var config = require("../config.json");
  var request = require("request");
  var util = require("util");
  var _ = require("lodash");

  /*
   * Load the Recycling Centre lookup resource and build a hash-table
   * keyed on the bit index. 
   */
  var loadAndBuildRCLookup = function(cb) {
    // Build query URL for lookup resource.
    var lookupURL = util.format("%s%s/data", config.baseQueryURL, config.RCLookupResourceId);
    // Execute GET request and await response.
    request.get(lookupURL, { json: true}, function(err, resp, body) {
      if (err || (resp && resp.statusCode !== 200)) {
        var msg = err ? err.message : body && body.message;
        cb(new Error("error getting RC lookup table: " + msg));
      } else {
        var lookupHash = {};
        // Build a hash indexed by RC bit number.
        _.forEach(body.data, function(v,k) {
          lookupHash[v.Bit_Index] = v;
        });         
        cb(null, lookupHash);
      }
    });    
  };
  
  return loadAndBuildRCLookup;   
}());
