module.exports = (function() {
  "use strict";
  var log = require("debug")("hwrc-tdxAPI");
  var request = require("request");
  var util = require("util");

  function TDXAPI(cfg) {
    this._config = cfg;
  }
  
  TDXAPI.prototype.authenticate = function(usr,pwd,cb) {
    var self = this;
    var options = {
      uri: util.format("%s/token", this._config.baseQueryURL),
      headers: { "Authorization": "Basic " + usr + ":" + pwd },
      json: true,
      body: { grant_type: "client_credentials"}
    };
    request.post(options, function(err, qres, body) {
      if (err) { 
        return cb(err); 
      }
      if (qres.statusCode === 200) {
        self._accessToken = body.access_token;
        cb(null, body);
      } else {
        cb(null, body || "unknown error");
      }
    });
  };

  TDXAPI.prototype.query = function(method, filter, projection, options, cb) {
    filter = filter ? JSON.stringify(filter) : "";
    projection = projection ? JSON.stringify(projection) : "";
    options = options ? JSON.stringify(options) : "";
    var query = util.format("%s/v1/%s?filter=%s&proj=%s&opts=%s", this._config.baseQueryURL, method, filter, projection, options);
    request.get(query, { json: true, headers: { authorization: "Bearer " + this._accessToken } }, cb);    
  };

  TDXAPI.prototype.truncateDataset = function(id, cb) {
    var command = util.format("%s/commandSync/resource/truncate", this._config.baseCommandURL);
    var postData = {};
    postData.id = id;
    request.post({ url: command, headers: { authorization: "Bearer " + this._accessToken }, json: true, body: postData }, function(err, response, body) {
      if (err) {
        cb(err);
      } else if (response && response.statusCode !== 200) {
        cb(new Error("failed to truncate dataset: " + (body.message || body.error)));
      } else {
        log("status code is: %s", response.statusCode);
        cb(err, body);
      }
    });
  };

  TDXAPI.prototype.addDatasetData = function(id, data, cb) {
    var command = util.format("%s/commandSync/dataset/data/createMany", this._config.baseCommandURL);
    var postData = {};
    postData.datasetId = id;
    postData.payload = data;
    request.post({ url: command, headers: { authorization: "Bearer " + this._accessToken }, json: true, body: postData }, function(err, response, body) {
      if (err) {
        cb(err);
      } else if (response && response.statusCode !== 200) {
        cb(new Error("failed to add dataset data: " + (body.message || body.error)));
      } else {
        cb(err, body);
      }          
    });
  };

  return TDXAPI;
}());