module.exports = (function(config, tdxAPI) {
  "use strict";
  var log = require("debug")("hwrc-costUpload");
  var fs = require("fs");
  var path = require("path");
  var _ = require("lodash");
  var CSVConverter = require("csvtojson").Converter;

  var render = function(req, res) { 
    res.render("costUpload"); 
  };

  var importCostData = function(accessToken, costDS, fileInfo, cb) {
    try {
      // File path is relative to app root folder.
      var filePath = path.join(__dirname, "../", fileInfo.path);
      // Create a CSV converter.
      var converter = new CSVConverter({});
      converter.fromFile(filePath, function(err, costData) {
        // Delete file.
        fs.unlink(filePath);
        if (costData.length > 0) {
          tdxAPI.truncateDataset(accessToken, costDS, function(err) {
            if (err) {
              return cb(err);
            }
            tdxAPI.addDatasetData(accessToken, costDS, costData, cb);
          });
        } else {
          cb(new Error("no data found"));
        }
      });    
    } catch (e) {
      cb(e);
    }
  };

  var uploadCostData = function(req, res) {
    var accessToken = req.user;
    importCostData(accessToken, req.session.costDS, req.file, function(err) {
      if (err) {
        log("failed to import %s [%s]", err.message);
        res.render("costUpload",{ feedback: err.message });
      } else {
        log("%s imported successfully", req.file.path);
        res.redirect("/");
      }
    });        
  };

  return {
    render: render,
    save: uploadCostData
  };
});