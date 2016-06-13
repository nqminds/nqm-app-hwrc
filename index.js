
(function() {
  "use strict";

  var log = require("debug")("hwrc-index");
  var argv = require("minimist")(process.argv.slice(2));
  var express = require('express');
  var app = express();
  var session = require("express-session");
  var util = require("util");
  var config = require("./config");
  var request = require("request");
  var aggregateTableFactory = null;
  var _ = require("lodash"); 

  // Initialise session
  app.use(session({ secret: "0928jkafja*()" }));

  // Initialise static routes and view engine 
  app.use(express.static('public'));
  app.set('view engine', 'pug');
  
  var checkAuthenticated = function(req, res, next) {
    if (req.session.authenticated) {
      return next();
    }
    var authURL = util.format("%s/auth?rurl=%s/auth", config.authServerURL, config.rootURL);
    res.redirect(authURL);
  };

  app.get("/auth", function(req,res) {
    // Auth server redirects here with access token.
    req.session.authenticated = req.query.access_token;
    res.redirect("/");
  });

  // Default route.
  app.get("/", checkAuthenticated, function(req, res) {
    request.get("http://q.nqminds.com/v1/datasets/S1xAEmTT-/data?access_token=" + req.session.authenticated, function(req, resp) {
      if (resp.statusCode !== 200) {
        log("FAILED: " + resp.body);
      } else {
        log("got data: %j", resp.body);
      }
      res.render("default");
    }); 
  });

  var tableViewRoute = function(req, res) {
    // Get request parameters.
    var resourceId = req.params.resourceId;     // resource Id    
    var pipelineParam = req.query.pipeline;     // pipeline details
    var nidMode = req.query.nidMode === "true"; // nid display mode

    aggregateTableFactory(resourceId, pipelineParam, nidMode, function(err, data) {
      if (err) {
        res.status(400).send(err.message);
      } else {
        res.render("aggregateTable", data);
      }
    });    
  };

  var csvRoute = function(req, res) {
    // Get request parameters.
    var resourceId = req.params.resourceId;     // resource Id    
    var pipelineParam = req.query.pipeline;     // pipeline details
    var nidMode = req.query.nidMode === "true"; // nid display mode

    aggregateTableFactory(resourceId, pipelineParam, nidMode, function(err, data) {
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

  // Load the RC lookup and build a hash-table for fast lookup.
  log("loading lookup resource");
  var loadRCLookup = require("./lib/rcLookup");
  loadRCLookup(function(err, rcLookupTable) {
    if (err) {
      log("failed to load lookup resource: %s", err.message);
    } else {
      // Initialise aggregate table factory.
      aggregateTableFactory = require("./lib/aggregateTableFactory")(rcLookupTable);

      // Setup aggregate table route.
      app.get("/model/:resourceId", tableViewRoute);

      // Setup csv aggregate table route.
      app.get("/model/csv/:resourceId", csvRoute);

      // Start the server.
      var port = argv.port || 7777;
      app.listen(port, function () {
        log("Listening on port " + port);
      });              
    }
  });
}());
