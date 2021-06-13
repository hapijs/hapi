'use strict';

const ChildProcess = require('child_process');
const Stream = require('stream');

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

internals.captureStd = function () {

    let stdOutput = '';
    let errOutput = '';
    let combinedOutput = '';

    const onStdout = (data) => {

        stdOutput += data;
        combinedOutput += data;
    };

    const onStderr = (data) => {

        errOutput += data;
        combinedOutput += data;
    };

    const complete = () => {

        return { stdOutput, errOutput, combinedOutput };
    };

    const out = new Stream.PassThrough();
    const err = new Stream.PassThrough();

    out.on('data', onStdout);
    err.on('data', onStderr);

    return {
        complete,
        out,
        err
    };
};

exports.hasLsof = internals.hasLsof();

exports.captureStd = internals.captureStd;
