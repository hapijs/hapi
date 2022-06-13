'use strict';

const ChildProcess = require('child_process');
const Http = require('http');
const Net = require('net');

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

internals.hasIPv6 = () => {

    const server = Http.createServer().listen();
    const { address } = server.address();
    server.close();

    return Net.isIPv6(address);
};

exports.hasLsof = internals.hasLsof();

exports.hasIPv6 = internals.hasIPv6();
