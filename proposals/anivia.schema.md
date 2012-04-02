var uuid = require('node-uuid');

// Request event (triggered .on('request', function(req, res){ /* payload goes here */ })
payload = {
  'message': {
    module: require("package.json").name, // ["hapi" | "ren" | "joi"] required
    host: os.hostname(), // required
    appVer: require("package.json").version,  // required
    events: [
      {
        event: 'request', // required: eventType
        properties: {
          headers: req._headers,
          responseTime: new Date - req._startTime,
          responseSize: res._headers['content-length'],
          timestamp: '' // required
        },
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
        event: 'op', // required: eventType
        properties: {
          os: {
            load: [0.8876953125, 0.62939453125, 0.52880859375], // NEW (what is contained in the array?)
            mem: {
              "total": 4294967296,
              "free": 2422153216
            }, // NEW (what is contained in the object?)
            cpu: 0.11,
            disk: {
              total: 1000000000, // GB? or kB default
              free: 800000000
            },
            uptime: 180739
          },
          proc: {
            uptime: 1807390323,
            mem: {
              rss: 21372928,
              heapTotal: 15487744,
              heapUsed: 8140392,
              total: 4294967296
            }, // NEW (what is contained in the object?)
            cpu: 0.00
          },
          timestamp: 13331321766079 // required
        },
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