module.exports = (function (RCLookupTable) {
  "use strict";

  var log = require("debug")("hwrc-aggregateTableFactory");
  var nqmUtils = require("nqm-utils");
  var request = require("request");
  var util = require("util");
  var _ = require("lodash");
  var config = require("../config.json");

  /*
   * Extract the named component from the pipeline array.
   * TODO - review - might need to support multiple components in a single
   * pipeline array, e.g. is it possible to have more than one $match per pipeline?
   */     
  var getPipelineComponent = function (arr, componentName) {
    var filtered = _.filter(arr, function (component) {
      return component.hasOwnProperty(componentName);
    });
    return (filtered && filtered.length > 0) ? filtered[0][componentName] : null;
  };
  
  /*
   * Build a URL identifying the given resource, pipeline and NID display mode.
   */
  var buildURL = function(resourceId, pipeline, nidMode) {
    return util.format("/%s/?pipeline=%j&nidMode=%s", resourceId, pipeline, nidMode);
  };
  
  /*
   * Build a URL identifying the given resource, pipeline, sort parameters and NID display mode.
   */
  var buildSortURL = function(resourceId, noSortPipeline, sortKey, desc, nidMode) {
    // Create the sort clause.
    var sort = { $sort: {} };
    sort.$sort[sortKey] = desc ? -1 : 1;
    return buildURL(resourceId, noSortPipeline.concat(sort), nidMode);
  };

  /*
   * Transform a NID in bit-index form to a human-readable text string.
   * Use 'showOpen' to determine if open or closed RC are listed.
   */
  var getNIDText = function(showOpen, nid) {
    var list = [];    
    var val = showOpen ? "1" : "0";
    _.forEach(nid, function(v,k) {
      if (v === val) {
        list.push(RCLookupTable[k].HWRC);
      }
    });    
    return list.join(", ");
  };

  /*
   * Aggregate table route-handler. 
   */
  var aggregateTableFactory = function (req, res) {
    // Get request parameters.
    var resourceId = req.params.resourceId;     // resource Id    
    var pipelineParam = req.query.pipeline;     // pipeline details
    var nidMode = req.query.nidMode === "true"; // nid display mode
  
    // Attempt to parse pipeline query parameter.
    var pipeline;  
    try {
      pipeline = JSON.parse(pipelineParam);      
    } catch (e) {
      log("failed to parse pipeline data: " + e.message);
      return res.status(400).send("failed to parse pipeline: " + e.message);
    }
    
    try {
      // Extract the component parts from the pipeline.
      var match = getPipelineComponent(pipeline, "$match");
      var group = getPipelineComponent(pipeline, "$group");
      var sort  = getPipelineComponent(pipeline, "$sort");
      
      // Cache a copy of the pipeline without the sort clause.        
      var noSortPipeline = [ {$match: match}, { $group: group }];
      
      // Flatten the group component and use it to build the list of columns.  
      var flattenedGroup = nqmUtils.flattenJSON(group);
      var columns = _.map(Object.keys(flattenedGroup), function (v, k) {
        // Clean up json path - remove all keys in path that begin with '$', e.g. $sum
        var cleaned = v.replace(/\.*\$[a-z0-9]*\.*/g, "");
        return {          
          // TODO - lookup a column-name based on the key? For now use the last component of the path.
          title: _.last(cleaned.split(".")),                                                              
          key: cleaned,          
          // Determine the column sort icon.
          sortIcon: sort[cleaned] ? (sort[cleaned] === 1 ? "arrow_drop_up" : "arrow_drop_down" ) : "", 
          // Set the column-heading sort url.
          sortURL: buildSortURL(resourceId, noSortPipeline, cleaned, sort[cleaned] === 1, nidMode)            
        } 
      });
      
      // Build TDX data query.
      var aggregateQuery = util.format("%s%s/aggregate?pipeline=%s", config.baseQueryURL, resourceId, pipelineParam);

      // Execute query and render results to aggregate table view.
      request.get(aggregateQuery, { json: true }, function (err, resp, body) {
        if (err || (resp && resp.statusCode !== 200)) {
          var msg = err ? err.message : body && body.message;
          res.status(500).send("failure running aggregate query: " + msg);            
        } else {
          // Make NID human-readable.
          var data = _.map(body.data, function(v,k) {
            v.__idx = k;
            v._id.NID = getNIDText(nidMode, v._id.NID);
            return v;
          });
          // Handle toggling between NID text display modes (open vs. closed)
          var nidModeToggle = {
            text: nidMode ? "show closed" : "show open",
            url: buildURL(resourceId, noSortPipeline.concat({$sort: sort}), !nidMode)
          };            
          // Pass response from query to aggregate table view. 
          res.render("aggregateTable", { columns: columns, data: data, nidModeToggle: nidModeToggle });            
        }
      });        
    } catch (e) {
      log("failure building aggregate query [%s]", e.message);
      res.status(400).send("failure building aggregate query: " + e.message);
    }
  };

  return aggregateTableFactory;
});
