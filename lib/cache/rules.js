/*
*   {
*       match: /regex/          // Required for array of rules, forbidden for single
*       isCached: true,         // Defaults to true
*       expiresInSec: 30,
*       expiresAt: '13:00',
*       staleInSec: 20          // Not implemented
*   }
*/

// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


exports.compile = function (config) {

    var rule = {};

    // Validate expiration settings

    if (config.expiresInSec ||
        config.expiresAt) {

        if (config.expiresAt) {
            if (config.expiresInSec === undefined) {
                var time = /^(\d\d?):(\d\d)$/.exec(config.expiresAt);
                if (time &&
                    time.length === 3) {

                    rule.expiresAt = { hours: parseInt(time[1], 10), minutes: parseInt(time[2], 10) };
                }
                else {
                    return new Error('Invalid time string');
                }
            }
            else {
                return new Error('Cannot have both relative and absolute expiration');
            }
        }
        else {
            rule.expiresInSec = config.expiresInSec;
        }
    }

    return rule;
};


exports.getTtl = function (rule, created) {

    var now = Date.now();
    created = created || now;
    var age = (now - created) / 1000;

    if (age >= 0) {
        if (rule.expiresInSec) {
            return rule.expiresInSec - age;
        }
        else if (rule.expiresAt) {
            var expiresAt = new Date(now);
            expiresAt.setHours(rule.expiresAt.hours);
            expiresAt.setMinutes(rule.expiresAt.minutes);
            expiresAt.setSeconds(0);

            if (expiresAt - now <= 0) {
                return 0;
            }

            var expiresInSec = (expiresAt.getTime() - created) / 1000;
            if (expiresInSec <= 0) {
                // Time passed for today, move to tomorrow
                expiresInSec += 24 * 60 * 60;
            }

            return expiresInSec - age;
        }
    }
    else {
        // Created in the future, assume expired/bad
        return 0;
    }
};