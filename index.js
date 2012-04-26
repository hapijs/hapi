// module.exports = require('./lib/hapi');
module.exports = process.env.EXPRESS_COV
   ? require('./lib-cov/hapi')
   : require('./lib/hapi');