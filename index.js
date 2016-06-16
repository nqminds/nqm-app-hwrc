
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

  // Configure the local strategy for use by Passport.
  //
  // The local strategy require a `verify` function which receives the credentials
  // (`username` and `password`) submitted by the user.  The function must verify
  // that the password is correct and then invoke `cb` with a user object, which
  // will be set at `req.user` in route handlers after authentication.
  passport.use(new Strategy(
    function(username, password, cb) {
      db.users.findByUsername(username, function(err, user) {
        if (err) { return cb(err); }
        if (!user) { return cb(null, false); }
        if (user.password != password) { return cb(null, false); }
        return cb(null, user);
      });
    }));


  // Configure Passport authenticated session persistence.
  //
  // In order to restore authentication state across HTTP requests, Passport needs
  // to serialize users into and deserialize users out of the session.  The
  // typical implementation of this is as simple as supplying the user ID when
  // serializing, and querying the user record by ID from the database when
  // deserializing.
  passport.serializeUser(function(user, cb) {
    cb(null, user.id);
  });

  passport.deserializeUser(function(id, cb) {
    db.users.findById(id, function (err, user) {
      if (err) { return cb(err); }
      cb(null, user);
    });
  });

  // Initialise static routes and view engine 
  app.use(express.static('public'));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'pug');

  app.use(require('cookie-parser')());
  app.use(require('body-parser').urlencoded({ extended: true }));

  // Initialise session
  app.use(require("express-session")({ secret: "0928jkafja*()", resave: false, saveUninitialized: false }));
  
  // Initialize Passport and restore authentication state, if any, from the
  // session.
  app.use(passport.initialize());
  app.use(passport.session());

  var checkAuthenticatedTDX = function(req, res, next) {
    if (req.session.authenticated) {
      return next();
    }
    var authURL = util.format("%s/auth?rurl=%s/auth", config.authServerURL, config.rootURL);
    res.redirect(authURL);
  };

  var checkAuthenticatedBasic = function(req, res, next) {
    var basicAuth = require("basic-auth");
    if (req.session.authenticated) {
      return next();
    }
    var authData = basicAuth(req);
    if (authData) {
      var options = {
        headers: { "Authorization": "Basic " + authData.name + ":" + authData.pass }
      };
      request.post("http://q.nqminds.com/token", options, { json: true, grant_type: "client_credentials"}, function(err, qreq, qres) {
        if (qres.statusCode === 200) {
          next();
        } else {
          res.set("WWW-Authenticate", "Basic realm=Authorization required");
          res.sendStatus(401);
        }
      });
    } else {
      res.set("WWW-Authenticate", "Basic realm=Authorization required");
      res.sendStatus(401);
    }
  };

  app.get("/auth", function(req,res) {
    // Auth server redirects here with access token.
    req.session.authenticated = req.query.access_token;
    res.redirect("/");
  });

  // Default route.
  app.get("/", ensureAuthenticated, function(req, res) {
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
