module.exports = (function(config, tdxAPI) {
  "use strict"
  var log = require("debug")("hwrc-costUpload");
  var fs = require("fs");
  var path = require("path");
  var _ = require("lodash");
  var CSVConverter = require("csvtojson").Converter;

  var costCalc = {};

  costCalc.working = false;
  costCalc.progress = null;
  costCalc.progressString = null;
  costCalc.targetCount = null;
  costCalc.loadedCount = null;
  costCalc.loaded = null;
  costCalc.loadedString = null;

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

            tdxAPI.addDatasetData(accessToken, costDS, costData, function(err){
              //console.log("importCostData: " + costData.length)
              cb(err, costData.length)

            });

          });
        } else {
          cb(new Error("no data found"));
        }
      });
    } catch (e) {
      cb(e);
    }
  };



  var calculateCostOutput = function(aCost, aTonnage){

    var data = [];
    var fail = [];

    for(var tonnage_index in aTonnage){
      var t = aTonnage[tonnage_index];

      //find the matching cost record and apply cost per tonne to tonnage
      for(var cost_index in aCost){
        var c = aCost[cost_index];

        if(c.First_Movement == t.First_Movement){
          if(c.HWRC == t.HWRC){
            if(c.Waste_Type == t.Waste_Type){
              if(c.Contract == t.Contract){

                var oRecord = {};

                var Cost;
                if(t.Tonnage > 0){
                  Cost = t.Tonnage * c.Cost;
                  Cost = Math.round(100 * Cost) / 100;
                } else {
                  Cost = 0;
                }

                var Delta_Cost;
                if(t.Delta_Tonnage > 0){
                  Delta_Cost = t.Delta_Tonnage * c.Cost;
                  Delta_Cost = Math.round(100 * Delta_Cost) / 100;
                } else {
                  Delta_Cost = 0;
                }



                oRecord.NID = t.NID
                oRecord.SID = t.SID
                oRecord.HWRC = t.HWRC;
                oRecord.Waste_Type = t.Waste_Type;
                oRecord.Contract = t.Contract;
                oRecord.First_Movement = t.First_Movement;
                oRecord.Tonnage = t.Tonnage;
                oRecord.Cost = Cost;
                oRecord.Delta_Tonnage = t.Delta_Tonnage;
                oRecord.Delta_Cost = Delta_Cost;

                oRecord.Winter = t.Winter;
                oRecord.Monday = t.Monday;
                oRecord.Tuesday = t.Tuesday;
                oRecord.Wednesday = t.Wednesday;
                oRecord.Thursday = t.Thursday;
                oRecord.Friday = t.Friday;
                oRecord.Saturday = t.Saturday;
                oRecord.Sunday = t.Sunday;



                data.push(oRecord);
                break
              }
            }
          }
        }
      }
    }
    return data
  };

  var nextTonnage = function(aCost, max, index, delta, tonnageDS, outputDS, cb, retrying) {


    if (index < max) {

      //track the calculation progress
      costCalc.progress = Math.round(100 * index / max);
      costCalc.progressString = String(("Calculated " + Math.round(100 * index / max) + "%: " + index + " out of " + max + " rows"));

      //track the tdx load progresss
      tdxAPI.query("datasets/" + outputDS + "/count", null, null, null, function (err, qres, outputCount) {
        costCalc.loadedCount = outputCount.count;
        costCalc.loaded = Math.round(100 * outputCount.count / max);
        costCalc.loadedString = String(("Loaded " + Math.round(100 * outputCount.count / max) + "%: " + outputCount.count + " out of " + max));
      });

      //console.log(index, delta)
      tdxAPI.query("datasets/" + tonnageDS + "/data", null, null, {
        "skip": index,
        "limit": delta
      }, function (err, qres, tonnageData) {

        if (err) {
          return cb("Tonnage Query Failed: " + err)
        } else {
          var aTonnage = tonnageData.data;
          var outputData = calculateCostOutput(aCost, aTonnage);

          //console.log(aTonnage.length, outputData.length)

          //tdxAPI._accessToken = "";

          tdxAPI.addDatasetData(outputDS, outputData, function (err, resAdd) {

            //var self = this;


            if (err) {
              console.log(err);

              if(err.statusCode === 401 && !retrying){
                // Possible token expiry - attempt to re-acquire a token and try again.
                log("failed with 401 (authorisation) - retrying");

              }


              // return cb("Add tonnage data failed: " + err)
            } else {
              nextTonnage(aCost, max, index + delta, delta, tonnageDS, outputDS, cb, false)
            }


          });
        }
      })

    } else if(index >= max && costCalc.loadedCount <= max) {

      tdxAPI.query("datasets/" + outputDS + "/count", null, null, null, function (err, qres, outputCount) {

        costCalc.progress = 100;
        costCalc.progressString = String(max + " calculations finished");


        costCalc.loadedCount = outputCount.count;
        costCalc.loaded = Math.round(100 * outputCount.count / max);
        costCalc.loadedString = String(("Loaded " + Math.round(100 * outputCount.count / max) + "%: " + outputCount.count + " out of " + max + " rows"));

        setTimeout(function(){
          nextTonnage(aCost, max, index + delta, delta, tonnageDS, outputDS, cb, false)
        } ,10000)

      })


    } else {

      costCalc.working = false;
      costCalc.progress = null;
      costCalc.progressString = null;
      costCalc.loadedCount = null;
      costCalc.loaded = null;
      costCalc.loadedString = null;

      cb("data ready")
    }


  };

  var uploadCostOutputData = function(req, res){

    if(costCalc.working == true){

      res.render("costUpload",{ feedback: "Calculation in progress, please again try later" });

    } else {


      costCalc.working = true;


      tdxAPI.truncateDataset(req.session.outputDS, function(err) {
        if (err) {
          console.log(err);
        }

        tdxAPI.query("datasets/" + req.session.costDS +  "/data", null, null, {"limit":10000}, function(err, qres, costData) {
          if(err){
            return cb("Cost Query Failed: " + err)
          }

          var aCost = costData.data;

          tdxAPI.query("datasets/" + req.session.tonnageDS +  "/count", null, null, null, function(err, qres, tonnageCount) {

            //console.log("cost length: " + aCost.length);

            if(err){
              // return cb("Tonnage Count Query Failed: " + err)
            }

            var max = tonnageCount.count;

            nextTonnage(aCost, max, 0, 10000, req.session.tonnageDS, req.session.outputDS, function(nextRes){
              console.log(nextRes);
            })
          });
        });


      });

      res.render("costCalc", {progress: "wait"})

    }


  };


  var checkCostDataImported = function(costDS, costTarget, cb){

    //console.log("target: " + costTarget)


    tdxAPI.query("datasets/" + costDS +  "/count", null, null, null, function(err, qres, costCount) {

      if(err){
        return cb(err)
      }

      //console.log("actual: " + costCount.count)

      if(costCount.count == costTarget){
        return cb(err, true)
      } else {

        setTimeout(function(){
            checkCostDataImported(costDS, costTarget, cb)
        } ,10000)

      }


    });
  };



  var uploadCostData = function(req, res) {

    var accessToken = req.user;
    importCostData(accessToken, req.session.costDS, req.file, function(err) {

      if (err) {
        log("failed to import %s [%s]", err.message);
        res.render("costUpload", {feedback: err.message});
      } else {
        log("%s imported successfully", req.file.path);

        checkCostDataImported(req.session.costDS, costTargetCount, function(err, checkRes){
          if(checkRes){
            uploadCostOutputData(req, res)
          }
        })

      }

    })

  };


  var costCalcProgress = function(req, res){

    if(costCalc.working == true){

      res.json(costCalc)

    } else {

      res.json("done")

    }


  };

  return {
    render: render,
    progress: costCalcProgress,
    save: uploadCostData
  };

});