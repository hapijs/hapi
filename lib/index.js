// Load modules

var Boom = require('boom');
var Glue = require('glue');
var Hoek = require('hoek');
var Statehood = require('statehood');
var Pack = require('./pack');


// Declare internals

var internals = {};


exports.version = require('../package.json').version;
exports.error = exports.Error = exports.boom = exports.Boom = Boom;
exports.Pack = Pack;
exports.Pack.compose = Glue.compose(exports);


exports.state = {
    prepareValue: Statehood.prepareValue
};


exports.createServer = function () {

    var args = Pack._args(arguments);

    var settings = Hoek.cloneWithShallow(args.options || {}, ['app', 'plugins']);
    var options = {
        cache: settings.cache,
        debug: settings.debug
    };

    delete settings.cache;

    var pack = new Pack(options);
    return pack.connection(args.host, args.port, settings);
};


exports.Server = function () {

    Hoek.assert(this.constructor === exports.Server, 'Server must be instantiated using new');
    return exports.createServer.apply(null, arguments);
};
