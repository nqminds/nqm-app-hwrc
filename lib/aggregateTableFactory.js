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
    return (filtered && filtered.length > 0) ? filtered[0][componentName] : {};
  };
  
  /*
   * Build a URL identifying the given resource, pipeline.
   */
  var buildURL = function(resourceId, pipeline) {
    return util.format("/model/%s/?pipeline=%j", resourceId, pipeline);
  };
  
  /*
   * Build a URL identifying the given resource, pipeline, sort parameters.
   */
  var buildSortURL = function(resourceId, noSortPipeline, sortKey, desc) {
    // Create the sort clause.
    var sort = { $sort: {} };
    sort.$sort[sortKey] = desc ? -1 : 1;
    return buildURL(resourceId, noSortPipeline.concat(sort));
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
  var aggregateTableFactory = function (accessToken, resourceId, pipelineParam, nidMode, cb) {

    // if pipeline empty add the default pipeline
    if(pipelineParam == "[]"){
      pipelineParam = '[{"$match":{"SID":"2021"}},{"$group":{"_id":{"NID":"$NID"},"Cost":{"$sum":"$Cost"}}}]';
    }
  
    // Attempt to parse pipeline query parameter.
    var pipeline;
    try {
      pipeline = JSON.parse(pipelineParam);      
    } catch (e) {
      log("failed to parse pipeline data: " + e.message);
      cb(new Error("failed to parse pipeline: " + e.message));
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
      var aggregateQuery = util.format("%s/v1/datasets/%s/aggregate?access_token=%s&pipeline=%s", config.baseQueryURL, resourceId, accessToken, pipelineParam);

      // Execute query and render results to aggregate table view.
      request.get(aggregateQuery, { json: true }, function (err, resp, body) {

        if (err || (resp && resp.statusCode !== 200)) {
          var msg = err ? err.message : body && body.message;
          cb(new Error("failure running aggregate query: " + msg));            
        } else {
          // Make NID human-readable.
          var data = _.map(body.data, function(v,k) {
            v.__idx = k;
            v._id.NID = getNIDText(nidMode, v._id.NID);
            return v;
          });

          // Round data numbers
          _.forEach(data, function(v0, k0){
            _.forEach(v0, function(v1, k1){
              if(typeof(v1)==="number"){
                data[k0][k1] =  _.round(v1, 2)
              }
            })
          });

          // Pass response from query to aggregate table view.
          cb(null, { columns: columns, data: data, hwrcLookup: RCLookupTable });           
        }
      });        
    } catch (e) {
      log("failure building aggregate query [%s]", e.message);
      cb(new Error("failure building aggregate query: " + e.message));
    }
  };

  // Model route - HTML render.
  var tableViewRoute = function(req, res) {
    // Get request parameters.
    var resourceId = req.params.resourceId;     // resource Id    
    var pipelineParam = req.query.pipeline;     // pipeline details
    var nidMode = !!req.session.nidMode;        // nid display mode

    aggregateTableFactory(req.user , resourceId, pipelineParam, nidMode, function(err, data) {


      var test = "test"

      if (err) {
        res.status(400).send(err.message);
      } else {
        res.render("aggregateTable", {data: data, accessToken: req.user, hwrcLookup: RCLookupTable});
      }
    });    
  };

  // Model route - download to CSV.
  var csvRoute = function(req, res) {
    // Get request parameters.
    var resourceId = req.params.resourceId;     // resource Id    
    var pipelineParam = req.query.pipeline;     // pipeline details
    var nidMode = !!req.session.nidMode;        // nid display mode

    aggregateTableFactory(req.user, resourceId, pipelineParam, nidMode, function(err, data) {
      if (err) {
        res.status(400).send(err.message);
      } else {
        // Set file name for download, and content type.
        res.setHeader("Content-disposition", "attachment; filename=hwrc-model.csv");
        res.set("Content-Type", "text/csv" );        
        
        // Write a heading for each column.
        _.forEach(data.columns, function(column) {
          res.write(column.title + ",");
        });
        res.write("\r\n");

        // Write each row of data.
        _.forEach(data.data, function(row) {
          _.forEach(data.columns, function(column) {
            // Use Array.reduce to lookup the json path, e.g. evaluate row["_id.SID"]
            res.write(util.format("\"%s\",",column.key.split(".").reduce(function(obj, key) { return obj[key] }, row)));
          });
          res.write("\r\n");
        });

        res.status(200).end();
      }
    });    
  };
  

  return {
    tableViewRoute: tableViewRoute,
    csvRoute: csvRoute
  };
});
