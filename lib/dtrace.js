// Load modules

var DTraceProvider = require('dtrace-provider');
var Utils = require('./utils');


// Declare internals

var internals = {};


internals.probes = {
    'pre.start': ['char *'],
    'pre.end': ['char *', 'json']
};

module.exports = internals.DTrace = function (name) {

    Utils.assert(this.constructor === internals.DTrace, 'DTrace must be instantiated using new');

    var dtrace = new DTraceProvider.DTraceProvider(name);

    var keys = Object.keys(internals.probes);
    for (var i = 0, il = keys.length; i < il; ++i) {

        var key = keys[i];
        var probe = dtrace.addProbe.apply(dtrace, [key].concat(internals.probes[key]));
        this._addProbe(key, probe);
    }

    dtrace.enable();
};


internals.DTrace.prototype._addProbe = function (key, probe) {

    this[key] = function (args) {

        probe.fire(function () {

            return [].concat(args);
        });
    };
};
