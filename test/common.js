'use strict';

const ChildProcess = require('child_process');
const Dns = require('dns');

const internals = {};

internals.hasLsof = () => {

    try {
        ChildProcess.execSync(`lsof -p ${process.pid}`, { stdio: 'ignore' });
    }
    catch (err) {
        return false;
    }

    return true;
};

exports.hasLsof = internals.hasLsof();

exports.setDefaultDnsOrder = () => {
    // Resolve localhost to ipv4 address on node v17
    if (Dns.setDefaultResultOrder) {
        Dns.setDefaultResultOrder('ipv4first');
    }
};
