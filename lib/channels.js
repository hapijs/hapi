'use strict';

exports = module.exports = {};

try {
    const DiagnosticsChannel = require('diagnostics_channel');

    exports = module.exports = {
        serverChannel: DiagnosticsChannel.channel('hapi:server')
    };
}
catch {
    // diagnostics_channel is not supported (e.g. node 12)
}

