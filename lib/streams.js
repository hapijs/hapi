'use strict';

const Stream = require('stream');

const Boom = require('@hapi/boom');
const Teamwork = require('@hapi/teamwork');

const internals = {
    team: Symbol('team')
};


exports.isStream = function (stream) {

    const isReadableStream = stream instanceof Stream.Readable;

    if (!isReadableStream &&
        typeof stream?.pipe === 'function') {
        throw Boom.badImplementation('Cannot reply with a stream-like object that is not an instance of Stream.Readable');
    }

    if (!isReadableStream) {
        return false;
    }

    if (stream.readableObjectMode) {
        throw Boom.badImplementation('Cannot reply with stream in object mode');
    }

    return true;
};


exports.drain = function (stream) {

    const team = new Teamwork.Team();
    stream[internals.team] = team;

    stream.on('readable', internals.read);
    stream.on('error', internals.end);
    stream.on('end', internals.end);
    stream.on('close', internals.end);

    return team.work;
};


internals.read = function () {

    while (this.read()) { }
};


internals.end = function () {

    this.removeListener('readable', internals.read);
    this.removeListener('error', internals.end);
    this.removeListener('end', internals.end);
    this.removeListener('close', internals.end);

    this[internals.team].attend();
};
