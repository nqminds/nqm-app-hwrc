
(function() {
  "use strict";
  
  var log = require("debug")("hwrc-index");
  var argv = require("minimist")(process.argv.slice(2));
  var express = require('express');
  var app = express();

  // Initialise static routes and view engine 
  app.use(express.static('public'));
  app.set('view engine', 'pug');
  
  // Default route.
  app.get("/", function(req, res) {
    res.render("default");
  });
  
  // Load the RC lookup and build a hash-table for fast lookup.
  log("loading lookup resource");
  var loadRCLookup = require("./lib/rcLookup");
  loadRCLookup(function(err, rcLookupTable) {
    if (err) {
      log("failed to load lookup resource: %s", err.message);
    } else {
      // Initialise aggregate table factory.
      var aggregateTableFactory = require("./lib/aggregateTableFactory")(rcLookupTable);
      
      // Setup aggregate table route.
      app.get("/:resourceId", aggregateTableFactory);

      // Start the server.
      var port = argv.port || 8888;
      app.listen(port, function () {
        console.log("Listening on port " + port);
      });              
    }
  });
}());
