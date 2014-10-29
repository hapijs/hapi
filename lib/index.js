// Load modules

var Boom = require('boom');
var Glue = require('glue');
var Hoek = require('hoek');
var Statehood = require('statehood');
var Pack = require('./pack');
var Connection = require('./connection');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.error = exports.Error = exports.boom = exports.Boom = Boom;
exports.Pack = Pack;
exports.Pack.compose = Glue.compose(exports);


exports.state = {
    prepareValue: Statehood.prepareValue
};


exports.Server = function () {

    Hoek.assert(this.constructor === exports.Server, 'Server must be instantiated using new');

    var args = Connection.args(arguments);

    var settings = Hoek.cloneWithShallow(args.options || {}, ['app', 'plugins']);
    var options = {
        cache: settings.cache,
        debug: settings.debug
    };

    delete settings.cache;

    var pack = new Pack(options);
    return pack.connection(args.host, args.port, settings);
};


exports.createServer = function () {

    return new exports.Server(arguments[0], arguments[1], arguments[2]);
};
