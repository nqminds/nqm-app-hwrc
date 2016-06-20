
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
      cb(null, user);
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
    // Redirect to model view if datasets are available,
    // otherwise redirect to settings.
    if (req.session.outputDS && req.session.costDS) {
      res.redirect(util.format("/model/%s?pipeline=[]", req.session.outputDS));
    } else {
      res.redirect("/settings");
    }    
  });

  // Login route.
  app.route("/login")
    .get(function(req,res) { res.render("login"); })
    .post(bodyParser.single(), passport.authenticate("local",{ successReturnToOrRedirect: "/settings", failureRedirect: "/login" }));

  // Settings route.
  app.route("/settings")
    .get(ensureAuthenticated(), settings.render)
    .post(ensureAuthenticated(), bodyParser.single(), settings.save);

  // Cost dataset upload handling.
  app.route("/cost-upload")
    .get(ensureAuthenticated(), costUpload.render)
    .post(ensureAuthenticated(), bodyParser.single("costs"), costUpload.save);

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
      var port = argv.port || 7777;
      app.listen(port, function () {
        log("Listening on port " + port);
      });              
    }
  });
}());
