'use strict';

const Teamwork = require('@hapi/teamwork');


const internals = {
    team: Symbol('team')
};


exports.isStream = function (stream) {

    return stream &&
        typeof stream === 'object' &&
        typeof stream.pipe === 'function';
};


exports.drain = function (stream) {

    const team = new Teamwork();
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
