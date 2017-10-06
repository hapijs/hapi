'use strict';

// Load modules


// Declare internals

const internals = {};


exports.drain = function (stream) {

    return new Promise((resolve) => {

        const read = () => stream.read();
        const end = () => {

            stream.removeListener('readable', read);
            stream.removeListener('error', end);
            stream.removeListener('end', end);

            resolve();
        };

        stream.on('readable', read);
        stream.on('error', end);
        stream.on('end', end);
    });
};
