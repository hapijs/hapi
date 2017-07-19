'use strict';

// Load modules


// Declare internals

const internals = {};


exports.drain = function (stream, callback) {

    const read = () => stream.read();
    const end = () => {

        stream.removeListener('readable', read);
        stream.removeListener('error', end);
        stream.removeListener('end', end);

        if (callback) {
            return callback();
        }
    };

    stream.on('readable', read);
    stream.once('error', end);
    stream.once('end', end);
};
