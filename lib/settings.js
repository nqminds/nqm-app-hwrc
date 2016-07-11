module.exports = (function(config, tdxAPI) {
  "use strict";
  var util = require("util");
  var log = require("debug")("hwrc-settings");

  // Settings route helper.
  var renderSettings = function(req, res, feedback) {
    var accessToken = req.user;

     // Get datasets based on output schema type.
    tdxAPI.query(accessToken, "datasets",{ "schemaDefinition.basedOn": config.outputDatasetSchema }, { name: 1, id: 1, _id: 0 }, null, function(err, qres, outputDatasets) {

      if (err) {
        outputDatasets = [ { name: "failed to query TDX" }];
      } else if (outputDatasets.length === 1) {
        // If there's only one dataset, pre-select it.
        req.session.outputDS = outputDatasets[0].id;
      }
      // Get datasets based on cost schema type.
      tdxAPI.query(accessToken, "datasets",{ "schemaDefinition.basedOn": config.costDatasetSchema }, { name: 1, id: 1, _id: 0 }, null, function(err, qres, costDatasets) {
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
    req.session.nidDS = config.nidDataset;

  };

  var saveSettings = function (req, res) {

    req.session.outputDS = req.body.outputDS;
    req.session.costDS = req.body.costDS;
    req.session.tonnageDS = config.tonnageDataset;
    req.session.nidDS = config.nidDataset;
    req.session.nidMode = req.body.showOpen === "open" ? true : false; 
    if (!req.session.outputDS || !req.session.costDS) {
      renderSettings(req, res, "please choose an output and cost dataset from the lists");
    } else {

      var accessToken = req.user;

      //check if the waste output has the same number of records as the tonnage outout
      tdxAPI.query(accessToken, "datasets/" + req.session.tonnageDS + "/count", null, null, null, function (err, qres, tonnageCount) {
          var target = tonnageCount.count;

        tdxAPI.query(accessToken, "datasets/" + req.session.outputDS + "/count", null, null, null, function (err, qres, outputCount) {
            var actual = outputCount.count;

            if (target == actual) {
            // Settings are valid => redirect to model view page.
            res.redirect(util.format("/model/%s?pipeline=[]", req.session.outputDS));
          } else {
            //offer to finsish calcs
            res.render("finishCalc", {target: target, actual: actual})

          }
        })
      })
    }
  };

  return {
    render: renderSettings,
    save: saveSettings
  };  
});