'use strict';

const Teamwork = require('teamwork');


const internals = {
    team: Symbol('team')
};


exports.drain = function (stream) {

    const team = new Teamwork();
    stream[internals.team] = team;

    stream.on('readable', internals.read);
    stream.on('error', internals.end);
    stream.on('end', internals.end);

    return team.work;
};


internals.read = function () {

    this.read();
};


internals.end = function () {

    this.removeListener('readable', internals.read);
    this.removeListener('error', internals.end);
    this.removeListener('end', internals.end);

    this[internals.team].attend();
};
