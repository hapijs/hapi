/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/*
*   {
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


exports.compile = function (configs) {

    if (configs instanceof Array) {

        var rules = [];

        for (var i = 0, il = configs.length; i < il; ++i) {

            var config = configs[i];
            var rule = internals.compileSingle(config, true);
            if (rule instanceof Error) {

                // Error
                return rule;
            }

            rules.push(rule);
        }

        return rules;
    }
    else {

        return internals.compileSingle(configs, false);
    }
};


internals.compileSingle = function (config, isMatchable) {

    var rule = {};

    // Check if cachable

    if (config.isCached !== false) {

        rule.isCached = true;

        // Validate matching rule

        if (isMatchable) {

            if (config.match) {

                if (config.match instanceof RegExp ||
                    typeof config.match === 'string') {

                    rule.match = config.match;
                }
                else {

                    return new Error('Bad match value');
                }
            }
            else {

                return new Error('Missing match');
            }
        }

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
    }
    else {

        rule.isCached = false;
    }

    return rule;
};


exports.match = function (key, rules) {

    for (var i = 0, il = rules.length; i < il; ++i) {

        var rule = rules[i];

        if (rule.match instanceof RegExp) {

            // Regular Expression

            if (rule.match.exec(key)) {

                return rule;
            }
        }
        else {

            // String

            if (key.indexOf(rule.match) >= 0) {

                return rule;
            }
        }
    }

    return null;
};


exports.isCached = function (key, rules) {

    var rule = (rules instanceof Array ? exports.match(key, rules) : rules);
    return (rule ? rule.isCached : false);
};


exports.expireInSec = function (key, rules) {

    var rule = (rules instanceof Array ? exports.match(key, rules) : rules);
    if (rule &&
        rule.isCached) {

        if (rule.expiresInSec) {

            return rule.expiresInSec;
        }
        else if (rule.expiresAt) {

            var now = (new Date()).getTime();
            var expiresAt = new Date(now);

            expiresAt.setHours(rule.expiresAt.hours);
            expiresAt.setMinutes(rule.expiresAt.minutes);

            var expiresInSec = (expiresAt.getTime() - now) / 1000;
            if (expiresInSec <= 0) {

                // Time passed for today, move to tomorrow
                expiresInSec += 24 * 60 * 60;
            }

            return expiresInSec;
        }
        else {

            // No expiration
            return 0;
        }
    }
    else {

        // No rule or not cached
        return null;
    }
};


exports.isExpired = function (key, rules, created) {

    var rule = (rules instanceof Array ? exports.match(key, rules) : rules);
    if (rule &&
        rule.isCached) {

        var now = Utils.getTimestamp();
        var age = (now - created) / 1000;

        if (age > 0) {

            if (rule.expiresInSec) {

                return age >= rule.expiresInSec;
            }
            else if (rule.expiresAt) {

                var expiresAt = new Date(created);
                expiresAt.setHours(rule.expiresAt.hours);
                expiresAt.setMinutes(rule.expiresAt.minutes);

                var expiresInSec = (expiresAt.getTime() - created) / 1000;
                if (expiresInSec <= 0) {

                    // Time passed for today, move to tomorrow
                    expiresInSec += 24 * 60 * 60;
                }

                return age >= expiresInSec;
            }
            else {

                // No expiration
                return false;
            }
        }
        else {

            // Created in the future, assume expired/bad
            return true;
        }
    }
    else {

        // No rule or not cached
        return true;
    }
};


