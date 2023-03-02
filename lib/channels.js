'use strict';

const DC = require('diagnostics_channel');

module.exports = {
    onServerChannel: DC.channel('hapi.onServer'),
    onRouteChannel: DC.channel('hapi.onRoute'),
    onResponseChannel: DC.channel('hapi.onResponse'),
    onRequestChannel: DC.channel('hapi.onRequest')
};
