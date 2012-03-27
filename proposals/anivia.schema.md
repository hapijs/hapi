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
              headers: req.headers
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
      'message': {
        module: require("package.json").name, // ["hapi" | "ren" | "joi"] required
        host: os.hostname(), // required
        appVer: require("package.json").version, // required
        events: [
          {
            event: 'monitor', // required: eventType
            properties: {
              os: {
                load: '',
                mem: '',
                cpu: '',
                disk: '',
                uptime: '',
                io: '', // Not yet implemented
                net: '' // Not yet implemented
              },
              proc: { 
                uptime: '',
                mem: '',
                cpu: ''
              },
              timestamp: '' // required
            },
          }
        ],
        mtimestamp: '' // required
      }
    }