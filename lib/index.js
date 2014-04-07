// Export public modules

exports.version = require('../package.json').version;
exports.error = exports.Error = exports.boom = exports.Boom = require('boom');
exports.Server = require('./server');
exports.Pack = require('./pack');
exports.Composer = require('./composer');

exports.state = {
    prepareValue: require('./state').prepareValue
};

exports.createServer = function () {

    return new exports.Server(arguments[0], arguments[1], arguments[2]);
};

