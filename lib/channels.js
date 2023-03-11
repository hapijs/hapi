'use strict';

const DC = require('diagnostics_channel');

exports.server = DC.channel('hapi.onServer');

exports.route = DC.channel('hapi.onRoute');

exports.response = DC.channel('hapi.onResponse');

exports.request = DC.channel('hapi.onRequest');
