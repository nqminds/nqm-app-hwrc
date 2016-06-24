module.exports = (function(config, tdxAPI) {
  "use strict";
  var util = require("util");

  // Settings route helper.
  var renderSettings = function(req, res, feedback) {
    // Get datasets based on output schema type.
    tdxAPI.query("datasets",{ "schemaDefinition.basedOn": config.outputDatasetSchema }, { name: 1, id: 1, _id: 0 }, null, function(err, qres, outputDatasets) {
      if (err) {
        outputDatasets = [ { name: "failed to query TDX" }];
      } else if (outputDatasets.length === 1) {
        // If there's only one dataset, pre-select it.
        req.session.outputDS = outputDatasets[0].id;
      }
      // Get datasets based on cost schema type.
      tdxAPI.query("datasets",{ "schemaDefinition.basedOn": config.costDatasetSchema }, { name: 1, id: 1, _id: 0 }, null, function(err, qres, costDatasets) {
        if (err) {
          costDatasets = [ { name: "failed to query TDX" }];
        } else if (costDatasets.length === 1) {
          // If there's only one dataset, pre-select it.
          req.session.costDS = costDatasets[0].id;
        }
        res.render("settings", { 
          outputDatasets: outputDatasets, 
          costDatasets: costDatasets, 
          outputDS: req.session.outputDS, 
          costDS: req.session.costDS,
          showOpen: req.session.nidMode, 
          feedback: feedback && typeof feedback === "string" ? feedback : "" 
        });
      });
    });

    req.session.tonnageDS = config.tonnageDataset;

  };

  var saveSettings = function(req, res) {
    req.session.outputDS = req.body.outputDS;
    req.session.costDS = req.body.costDS;
    req.session.tonnageDS = config.tonnageDataset;
    req.session.nidMode = req.body.showOpen === "open" ? true : false; 
    if (!req.session.outputDS || !req.session.costDS) {
      renderSettings(req, res, "please choose an output and cost dataset from the lists");
    } else {
      // Settings are valid => redirect to model view page.
      res.redirect(util.format("/model/%s?pipeline=[]", req.session.outputDS));
    }
  };

  return {
    render: renderSettings,
    save: saveSettings
  };  
});