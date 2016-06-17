module.exports = (function() {
  "use strict";
  var log = require("debug")("hwrc-cost-upload");
  var fs = require("fs");
  var path = require("path");
  var _ = require("lodash");
  var CSVConverter = require("csvtojson").Converter;

  var importCostData = function(tdxApi, costDS, fileInfo, cb) {
    try {
      // File path is relative to app root folder.
      var filePath = path.join(__dirname, "../", fileInfo.path);
      // Create a CSV converter.
      var converter = new CSVConverter({});
      converter.fromFile(filePath, function(err, costData) {
        // Delete file.
        fs.unlink(filePath);
        if (costData.length > 0) {
          tdxApi.truncateDataset(costDS, function(err) {
            if (err) {
              return cb(err);
            }
            tdxApi.addDatasetData(costDS, costData, cb);
          });
        } else {
          cb(new Error("no data found"));
        }
      });    
    } catch (e) {
      cb(e);
    }
  };

  return {
    importCostData: importCostData
  }
}());