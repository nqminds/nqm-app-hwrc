
(function() {
  "use strict";

  var log = require("debug")("hwrc-index");
  var argv = require("minimist")(process.argv.slice(2));
  var express = require('express');
  var app = express();
  var util = require("util");
  var config = require("./config");
  var request = require("request");
  var aggregateTableFactory = null;
  var _ = require("lodash"); 
  var passport = require('passport');
  var Strategy = require('passport-local').Strategy;
  var ensureAuthenticated = require('connect-ensure-login').ensureLoggedIn;
  var multer = require("multer");
  var bodyParser = multer({ dest: "uploads/" });
  var TDXApi = require("./lib/tdx-api");
  var tdxAPI = new TDXApi(config); 

  // Configure the local strategy for use by Passport.
  //
  // The local strategy require a `verify` function which receives the credentials
  // (`username` and `password`) submitted by the user.  The function must verify
  // that the password is correct and then invoke `cb` with a user object, which
  // will be set at `req.user` in route handlers after authentication.
  passport.use(new Strategy(
    function(username, password, cb) {
      tdxAPI.authenticate(username, password, cb);
    }
  ));

  // Configure Passport authenticated session persistence.
  passport.serializeUser(function(user, cb) {
    // Just perist the access token.
    process.nextTick(function() {
      cb(null, user.access_token);
    });    
  });

  passport.deserializeUser(function(id, cb) {
    // Pass on the access token as is.
    process.nextTick(function() {
      cb(null, id);
    });
  });

  // Initialise static routes and view engine 
  app.use(express.static('public'));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'pug');

  app.use(require('cookie-parser')());
  // app.use(require('body-parser').urlencoded({ extended: true }));

  // Initialise session
  app.use(require("express-session")({ secret: "0928jkafja*()", resave: false, saveUninitialized: false }));
  
  // Initialize Passport and restore authentication state, if any, from the
  // session.
  app.use(passport.initialize());
  app.use(passport.session());

  // Default route.
  app.get("/", ensureAuthenticated(), function(req, res) {
    res.render("default", { outputDS: req.session.outputDS, costDS: req.session.costDS });
  });

  app.get("/login", function(req,res) {
    res.render("login");
  });

  app.post("/login", bodyParser.single(), passport.authenticate("local",{ successReturnToOrRedirect: "/choose", failureRedirect: "/login" }));

  var renderChooser = function(req, res, feedback) {
    tdxAPI.query("datasets",{ "schemaDefinition.basedOn": config.outputDatasetSchema }, { name: 1, id: 1, _id: 0 }, null, function(err, qres, body) {
      res.render("choose", { datasets: body, outputDS: req.session.outputDS, costDS: req.session.costDS, feedback: feedback || "" });
    });
  };

  app.get("/choose", ensureAuthenticated(), renderChooser);

  app.post("/choose", ensureAuthenticated(), bodyParser.single(), function(req, res) {
    req.session.outputDS = req.body.outputDS;
    req.session.costDS = req.body.costDS;
    if (!req.session.outputDS || !req.session.costDS) {
      renderChooser(req, res, "please select datasets");
    } else {
      res.redirect(util.format("/model/%s?pipeline=[]", req.session.outputDS));
    }
  });

  app.get("/cost-upload", function(req, res) {
    res.render("cost-upload");
  });

  app.post("/cost-upload", bodyParser.single("costs"), function(req, res) {
    var costUpload = require("./lib/cost-upload");
    costUpload.importCostData(tdxAPI, req.session.costDS, req.file, function(err) {
      if (err) {
        log("failed to import %s [%s]", err.message);
        res.render("cost-upload",{ feedback: err.message });
      } else {
        log("%s imported successfully", req.file.path);
        res.redirect("/");
      }
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
      app.get("/model/:resourceId", ensureAuthenticated(), tableViewRoute);

      // Setup csv aggregate table route.
      app.get("/model/csv/:resourceId", ensureAuthenticated(), csvRoute);

      // Start the server.
      var port = argv.port || 7777;
      app.listen(port, function () {
        log("Listening on port " + port);
      });              
    }
  });
}());
