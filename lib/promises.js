'use strict';

// Load modules


// Declare internals

const internals = {};


exports.wrap = function (bind, method, args) {

    return new Promise((resolve, reject) => {

        const callback = (err, result) => {

            if (err) {
                return reject(err);
            }

            return resolve(result);
        };

        method.apply(bind, args ? args.concat(callback) : [callback]);
    });
};
