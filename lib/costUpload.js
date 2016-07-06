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
  costCalc.interupt = false;

  costCalc.err = false;


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
	
	//dont need delta
  var nextTonnage = function(accessToken, aCost, max, aNid, delta, tonnageDS, outputDS, cb) {

    //if(index > 1){accessToken = "";}
    //accessToken = ""

    if(costCalc.interupt == true){

      costCalc.interupt = false;

      return cb("calculation interupted")

    }


    // if (index < max) {
	if(aNid.length > 0){

      //track the calculation progress
      // costCalc.progress = Math.round(100 * index / max);      

	  costCalc.progress = 1;
	  costCalc.progressString = aNid.length + " scenarios left to calculate";

      //track the tdx load progresss

      tdxAPI.query(accessToken, "datasets/" + outputDS + "/count", null, null, null, function (err, qres, outputCount) {

        if(err){
          console.log(err)
        } else {
          costCalc.loadedCount = outputCount.count;
          costCalc.loaded = Math.round(100 * outputCount.count / max);
          costCalc.loadedString = String(("Loaded " + Math.round(100 * outputCount.count / max) + "%: " + outputCount.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " out of " + max.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")));
        }
      });
	  
	  var nid = aNid.pop();
      console.log(nid)
      tdxAPI.query(accessToken, "datasets/" + tonnageDS + "/data", {"NID":nid}, null, {
        // "skip": index,
        "limit": 1000000
      }, function (err, qres, tonnageData) {

        if (err) {
          return cb(err)

        } else {
			
		  // console.log(tonnageData)
			// for(var aa in tonnageData){
				// console.log(aa)
			// }
			
			// console.log(tonnageData)

			
          var aTonnage = tonnageData.data;
          var outputData = calculateCostOutput(aCost, aTonnage);

          console.log(aTonnage.length, outputData.length)

          //tdxAPI._accessToken = "";

          tdxAPI.addDatasetData(accessToken, outputDS, outputData, function (err, resAdd) {

            if (err) {
              return cb(err);

              // return cb("Add tonnage data failed: " + err)
            } else {
              nextTonnage(accessToken, aCost, max, aNid, delta, tonnageDS, outputDS, cb, false)
            }


          });
        }
      })

    } else if(aNid.length == 0 && costCalc.loadedCount <= max) {

      tdxAPI.query(accessToken, "datasets/" + outputDS + "/count", null, null, null, function (err, qres, outputCount) {

        if(err){
          return cb(err)
        }

        costCalc.progress = 100;
        costCalc.progressString = String("All scenarios calculated");


        costCalc.loadedCount = outputCount.count;
        costCalc.loaded = Math.round(100 * outputCount.count / max);
        costCalc.loadedString = String(("Loaded " + Math.round(100 * outputCount.count / max) + "%: " + outputCount.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " out of " + max.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " rows"));

        setTimeout(function(){
          nextTonnage(accessToken, aCost, max, index + delta, delta, tonnageDS, outputDS, cb, false)
        } ,10000)

      })


    } else {

      costCalc.working = false;
      costCalc.progress = null;
      costCalc.progressString = null;
      costCalc.loadedCount = null;
      costCalc.loaded = null;
      costCalc.loadedString = null;

      cb(err, "data ready")
    }


  };


  var startCostOutputCalcs = function(accessToken, costDS, tonnageDS, outputDS, nidDS, index_start, cb){

    tdxAPI.query(accessToken, "datasets/" + costDS +  "/data", null, null, {"limit":10000}, function(err, qres, costData) {
      if(err){
        return cb("Cost Query Failed: " + err)
      }

      var aCost = costData.data;

      tdxAPI.query(accessToken, "datasets/" + tonnageDS +  "/count", null, null, null, function(err, qres, tonnageCount) {

        //console.log("cost length: " + aCost.length);

        if(err){
          // return cb("Tonnage Count Query Failed: " + err)
        }

        var max = tonnageCount.count;
		
		tdxAPI.query(accessToken, "datasets/" + nidDS +  "/data", null, null, {"limit":max}, function(err, qres, nidData) {
			
	        if(err){
			  console.log(err)
			}
			// console.log("data:")
			// console.log(nidData.data[0].permutation_set.length)
			//todo make permutation set configuable
			var aNid = nidData.data[0].permutation_set


			nextTonnage(accessToken, aCost, max, aNid, 10000, tonnageDS, outputDS, function(err, nextRes){

			  if(err){
				return cb(err)
			  }

			  console.log(nextRes);
			})
		});



      });
    });



  };

  var uploadCostOutputData = function(accessToken, req, res){

    if(costCalc.working == true){

      res.render("costUpload",{ feedback: "Calculation in progress, please again try later" });

    } else {


      costCalc.working = true;


      tdxAPI.truncateDataset(accessToken, req.session.outputDS, function(err) {
        if (err) {
          console.log(err);
        }

        startCostOutputCalcs(accessToken, req.session.costDS, req.session.tonnageDS, req.session.outputDS, req.session.nidDS, 0, function(err){
          if(err){
            console.log(err)
            costCalc.err = true;
          }
        })

      });

      res.render("costCalc", {progress: "wait"})

    }


  };


  var checkCostDataImported = function(accessToken, costDS, costTarget, cb){

    //console.log("target: " + costTarget)
    //
    //console.log(costDS)


    tdxAPI.query(accessToken, "datasets/" + costDS +  "/count", null, null, null, function(err, qres, costCount) {

      if(err){
        return cb(err)
      }

      //console.log("actual: " + costCount.count)

      if(costCount.count == costTarget){
        return cb(err, true)
      } else {

        setTimeout(function(){
            checkCostDataImported(accessToken, costDS, costTarget, cb)
        } ,10000)

      }


    });
  };



  var uploadCostData = function(req, res) {

    var accessToken = req.user;
    importCostData(accessToken, req.session.costDS, req.file, function(err, costTargetCount) {

      if (err) {
        log("failed to import %s [%s]", err.message);
        res.render("costUpload", {feedback: err.message});
      } else {
        log("%s imported successfully", req.file.path);

        checkCostDataImported(accessToken, req.session.costDS, costTargetCount, function(err, checkRes){
          if(checkRes){
            uploadCostOutputData(accessToken, req, res)
          }
        })

      }

    })

  };

  var getStartIndex = function(req, res, previous, cb){

    var accessToken = req.user;

    tdxAPI.query(accessToken, "datasets/" + req.session.outputDS + "/count", null, null, null, function (err, qres, outputCount) {

      //console.log("cost length: " + aCost.length);

      if (err) {
        // return cb("Tonnage Count Query Failed: " + err)
      }

      var index_start = outputCount.count;

      if(index_start != previous){

        console.log(previous, index_start)

        costCalc.progressString = "Waiting for import queue to load..."
        costCalc.loadedString = String(("Loaded " + outputCount.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " rows"));


        setTimeout(function(){
          getStartIndex(req, res, index_start, cb)
        } ,10000)

      } else {

        cb(index_start)

      }


    })


  };



/*   var finishCostCalc = function(req, res){


    if(costCalc.working == true){

      //set interupt flag
      costCalc.interupt = true;

      costCalc.err = true;

      costCalc.working = false;
      costCalc.progress = null;
      costCalc.progressString = null;
      costCalc.loadedCount = null;
      costCalc.loaded = null;
      costCalc.loadedString = null;

      console.log(costCalc.working)

    } else {

      costCalc.restart = false;
      costCalc.working = true;

      var accessToken = req.user;

      //get index
      getStartIndex(req, res, 0, function(index_start){

        startCostOutputCalcs(accessToken, req.session.costDS, req.session.tonnageDS, req.session.outputDS, req.session.nidDS, index_start, function(err){
          if(err){
            console.log(err)
            costCalc.err = true;
          }
        })

      });

      res.render("costCalc", {progress: "wait"});

    }

  }; */


  var costCalcProgress = function(req, res){


    if(costCalc.err == true) {


      //reset costCalc
      costCalc.err = false;
      costCalc.working = false;
      costCalc.progress = null;
      costCalc.progressString = null;
      costCalc.loadedCount = null;
      costCalc.loaded = null;
      costCalc.loadedString = null;

      res.json("error")

    } else if(costCalc.working == true){
      res.json(costCalc)

    } else {
      res.json("done")
    }


  };

  return {
    render: render,
    progress: costCalcProgress,
    save: uploadCostData//,
    // finish: finishCostCalc
  };

});