'use strict';

const Somever = require('@hapi/somever');

module.exports = {
    'coverage-predicates': {
        allowsStoppedReq: Somever.match(process.version, '<18.19.0'),
    }
};
