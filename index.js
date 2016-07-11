
(function() {
  "use strict";

  var log = require("debug")("hwrc-index");
  var argv = require("minimist")(process.argv.slice(2));
  var express = require('express');
  var app = express();
  var util = require("util");
  var request = require("request");
  var aggregateTableFactory = null;
  var _ = require("lodash"); 
  var passport = require('passport');
  var Strategy = require('passport-local').Strategy;
  var ensureAuthenticated = require('connect-ensure-login').ensureLoggedIn;
  var bodyParser = require("multer")({ dest: "uploads/" });
  var config = require("./config");
  var tdxAPI = (new (require("nqm-api-tdx"))(config));

  var settings = require("./lib/settings")(config, tdxAPI);

  var costUpload = require("./lib/costUpload")(config, tdxAPI);

  //if a cache for privateQueries
  var privateQueryList = {};
  privateQueryList.Count = 0;
  



  // Configure the local strategy for use by Passport.
  //
  // The local strategy require a `verify` function which receives the credentials
  // (`username` and `password`) submitted by the user.  The function must verify
  // that the password is correct and then invoke `cb` with a user object, which
  // will be set at `req.user` in route handlers after authentication.
  passport.use(new Strategy(
      function (username, password, cb) {
          log("new strategy");
      tdxAPI.authenticate(username, password, cb);
    }
  ));

  // Configure Passport authenticated session persistence.
  passport.serializeUser(function (user, cb) {
      log("passort serialze user");
    // Just perist the access token.
      process.nextTick(function () {
          log("persist access Token");
      cb(null, user);
    });    
  });

  passport.deserializeUser(function (id, cb) {
      log("passort deserialze user");
    // Pass on the access token as is.
      process.nextTick(function () {
          log("pass on access token");
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
    // Redirect to model view if datasets are available,
    // otherwise redirect to settings.
      log("authenticated");
      if (req.session.outputDS && req.session.costDS) {
          log("request main query");
      res.redirect(util.format('/model/%s?pipeline=[]', req.session.outputDS));
      } else {
          log("go to settings");
      res.redirect("/settings");
    }    
  });


  // Login route.
  app.route("/login")
      .get(function (req, res) {
          log("get login...");
          res.render("login");
      })
    .post(bodyParser.single(), passport.authenticate("local",{ successReturnToOrRedirect: "/settings", failureRedirect: "/login" }));

  // Settings route.
  app.route("/settings")
    .get(ensureAuthenticated(), settings.render)
    .post(ensureAuthenticated(), bodyParser.single(), settings.save);

  // Cost dataset upload handling.
  app.route("/cost-upload")
    .get(ensureAuthenticated(), costUpload.render)
    .post(ensureAuthenticated(), bodyParser.single("costs"), costUpload.save);

  app.route("/cost-calc")
      .get(ensureAuthenticated(), function(req,res) { res.render("costCalc", {progress: "wait"});})

  // app.route("/finish-calc")
      // .get(ensureAuthenticated(), costUpload.finish);


  //Cost output dataset calculation handling
  app.route("/progress")
      .get(ensureAuthenticated(), costUpload.progress);

  //query private dataset
  //app.get("/query/:datasetId/:method/:filter/:projection/:options", function(req, res){
  app.get("/privateQuery/:datasetId/:command/:qString/:cache", function (req, res) {


    var datasetId = req.params["datasetId"];
    var command = req.params["command"];
    var qString = req.params["qString"];
    var cache = req.params["cache"]; 
    var accessToken = req.user;

    var query = config.baseQueryURL +
        "/v1/datasets/" + datasetId + "/" +
        command + "?" + "access_token=" +  accessToken + "&" +
        qString;
    
    
    //if the query has been cached, send the cached data
    if (privateQueryList.hasOwnProperty(query)) {
        log("using cached query:")// + query)
        return res.status(200).json(privateQueryList[query])
    };


    //console.log(query)

    request.get(query, { json: true }, function (err, resp, body) {

      if (err) {
        res.status(400).send(err.message);
        console.log(err)
      } else {
        //console.log(body)
        //cache the query response 
          if (cache && privateQueryList.Count < 1000) {

              console.log(privateQueryList.Count)
              privateQueryList.Count = Object.keys(privateQueryList).length;

              log("caching query: ")// + query)
              privateQueryList[query] = body;

        }
        res.status(200).json(body)
      }

    })

  })

  // Logout route.
  app.get("/logout", function(req,res) {
    req.logout();
    res.redirect("/");
  });

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
      app.get("/model/:resourceId", ensureAuthenticated(), aggregateTableFactory.tableViewRoute);

      // Setup csv aggregate table route.
      app.get("/model/:resourceId/csv", ensureAuthenticated(), aggregateTableFactory.csvRoute);

      // Start the server.
      var port = argv.port || 8888;
      app.listen(port, function () {
        log("Listening on port " + port);
        console.log("Listening on port " + port)
      });              
    }
  });
}());
