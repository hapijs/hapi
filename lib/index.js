// Export public modules

exports.error = exports.Error = exports.boom = exports.Boom = require('boom');
exports.Server = require('./server');
exports.response = require('./response');
exports.utils = require('./utils');
exports.types = require('./validation').types;
exports.Pack = require('./pack');
exports.Composer = require('./composer');
exports.client = require('./client');

exports.state = {
    prepareValue: require('./state').prepareValue
};

exports.createServer = function () {

    return new exports.Server(arguments[0], arguments[1], arguments[2]);
};


exports.joi = {
    version: function (version) {

        require('./validation').version(version);
        exports.types = require('./validation').types;
    }
};