// Load modules

var Utils = require('./utils');
// dtrace-provider loaded inline when installed


// Declare internals

var internals = {};


module.exports = internals.DTrace = function (name) {

    if (!internals.DTrace.isInstalled()) {
        this.report = function () {};
        return;
    }

    this._probes = {};
    this._provider = new internals.DTrace.Provider(name);
};


internals.DTrace.prototype.report = function (key/* arg1, arg2 */) {

    var args = Array.prototype.slice.call(arguments, 1);
    var probe = this._probes[key] || this._addProbe(key, args);         // If probe not found create and add it

    probe.fire(function () {

        return args;
    });
};


internals.DTrace.prototype._addProbe = function (key, values) {

    var paramTypes = [];
    for (var i = 0, il = values.length; i < il; ++i) {
        var value = values[i];
        if (typeof value === 'number') {
            paramTypes.push('int');
        }
        else if (value !== null && typeof value === 'object') {
            paramTypes.push('json');
        }
        else {
            paramTypes.push('char *');
        }
    }

    var probe = this._provider.addProbe.apply(this._provider, [key].concat(paramTypes));
    this._probes[key] = probe;

    this._provider.disable && this._provider.disable();                                             // Provider must be disabled/enabled for probe to be visible (extra disable check needed for provider bug that has PR)
    this._provider.enable();

    return probe;
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