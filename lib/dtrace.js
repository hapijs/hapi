// Load modules

var Utils = require('./utils');
// dtrace-provider loaded inline when installed


// Declare internals

var internals = {};


internals.probes = {
    'pre.start': ['char *'],
    'pre.end': ['char *', 'json']
};

module.exports = internals.DTrace = function (name) {

    Utils.assert(this.constructor === internals.DTrace, 'DTrace must be instantiated using new');

    if (!internals.DTrace.isInstalled()) {
        this.report = function () {};
        return;
    }

    var dtrace = new internals.DTrace.Provider(name);
    this._probes = {};
    var keys = Object.keys(internals.probes);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var key = keys[i];
        var probe = dtrace.addProbe.apply(dtrace, [key].concat(internals.probes[key]));
        this._probes[key] = probe;
    }

    dtrace.enable();
};


internals.DTrace.prototype.report = function (key, args) {

    this._probes[key].fire(function () {

        return args;
    });
};


internals.DTrace.isInstalled = function () {

    var result = false;
    try {
        result = !!require.resolve('dtrace-provider');
    }
    catch (err) {}

    internals.DTrace.isInstalled = function () {

        return result;
    };

    return result;
};


internals.DTrace.Provider = internals.DTrace.isInstalled() && require('dtrace-provider').DTraceProvider;