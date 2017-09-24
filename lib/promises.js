'use strict';

// Load modules


// Declare internals

const internals = {};


exports.split = function (resolve, reject) {

    return function (err, result) {

        if (err) {
            reject(err);
            return;
        }

        resolve(result);
        return;
    };
};
