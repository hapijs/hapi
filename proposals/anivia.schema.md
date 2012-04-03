var uuid = require('node-uuid');

// Request event (triggered .on('request', function(req, res){ /* payload goes here */ })
payload = {
  'message': {
    module: require("package.json").name, // ["hapi" | "ren" | "joi"] required
    host: os.hostname(), // required
    appVer: require("package.json").version,  // required
    events: [
      {
          "event": "request",
          "properties": {
            "headers": {
              "accept": "*/*",
              "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.142 Safari/535.19",
              "accept-encoding": "gzip,deflate,sdch",
              "accept-language": "en-US,en;q=0.8",
              "accept-charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
              "remote-address": "127.0.0.1"
            },
            "responseTime": 1,
            "responseSize": 67,
            "timestamp": 1333395487658
          }
        }
    ],
    mtimestamp: '' // required
  }
}

// Metering event
payload = {
  'message': { // here
    module: require("package.json").name, // ["hapi" | "ren" | "joi"] required
    host: os.hostname(), // required
    appVer: require("package.json").version, // required
    events: [
      {
        "event": "op",
        "properties": {
          "os": {
            "load": [
              1.1591796875,
              0.8876953125,
              0.759765625
            ],
            "mem": {
              "total": 4294967296,
              "free": 379211776
            },
            "disk": {
              "total": 488555536,
              "used": 95442776
            },
            "uptime": 2609
          },
          "proc": {
            "uptime": 1,
            "mem": {
              "rss": 20934656,
              "heapTotal": 14975680,
              "heapUsed": 6494440,
              "total": 4294967296
            },
            "cpu": "0.00"
          },
          "timestamp": 1333395900932
        }
      }
    ],
    mtimestamp: 13331321766079 // required
  }
}

// Logging event
payload = {
  message: {
    module: require("./package.json").name,
    host: os.hostname(),
    appVer: require("./package.json").version,
    events: [
      {
        event: 'log',
        properties: {
          timestamp: '',
          level: '', // INFO, LOG, ERROR 0,1,2,3
          message: '',
          cdr: '' // splat... of the log items stringified and concatenated w/ '|' delim or something
        }
      }
    ]
  }
}