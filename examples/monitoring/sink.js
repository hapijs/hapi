var express = require("express");

var app = express.createServer();

app.configure(function() {
  
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(function(){
    
    return function(req, res, next) {
      
      next();
    };
  }());
});

app.get("/analytics/log", function(req, res) {
  
  res.send("ohai");
});

app.post("/analytics/log", function(req, res) {
  
  console.log("log", req.body);
  res.send("1");
});

app.post("/analytics/blammo", function(req, res) {
  
  console.log(req.body.events[0].event, JSON.stringify(req.body, null, 2));
  res.send('1');
});

app.listen(9000, function() {
  
  console.log("sink server started on port "+ app.address().port);
});