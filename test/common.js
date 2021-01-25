'use strict';

const ChildProcess = require('child_process');

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
