// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


internals.getCached = function (cache, key, log, callback) {

    // Check if cache enabled

    if (!cache.isMode('server')) {
        return callback();
    }

    // Lookup in cache

    var timer = new Utils.Timer();
    cache.get(key, function (err, cached) {

        // Error

        if (err) {
            log(['cache', 'get'], null, err);
            return callback();
        }

        // Not found

        if (!cached ||
            !cached.item) {

            log(['cache', 'get'], { msec: timer.elapsed() });
            return callback();
        }

        // Found

        log(['cache', 'get'], { msec: timer.elapsed(), stored: cached.stored, ttl: cached.ttl, isStale: cached.isStale });
        return callback(cached);
    });
};


internals.saveToCache = function (cache, key, log, value, ttl) {

    if (!cache.isMode('server')) {
        return;
    }

    // Lazy save

    var timer = new Utils.Timer();
    cache.set(key, value, ttl, function (err) {

        log(['cache', 'set'], { msec: timer.elapsed() }, err);
    });
};


exports.process = function (cache, key, logFunc, baseTags, generateFunc, callback) {

    // Logging helper

    var log = function (tags, data, err) {

        var eventTags = baseTags.concat(tags);
        if (err) {
            eventTags.concat('error');
            data = data || {};
            data.error = err.message;
        }

        logFunc(eventTags, data);
    };

    // Get from cache

    internals.getCached(cache, key, log, function (cached) {

        // Check if found and fresh

        if (cached &&
            !cached.isStale) {

            return callback(cached.item, cached);
        }

        // Not in cache, or cache stale

        var wasCallbackCalled = false;                  // Track state between stale timeout and generate fresh

        if (cached &&
            cached.isStale) {

            // Set stale timeout

            cached.ttl -= cache.rule.staleTimeout;       // Adjust TTL for when the timeout is invoked
            setTimeout(function () {

                if (wasCallbackCalled) {
                    return;
                }

                wasCallbackCalled = true;
                return callback(cached.item, cached);
            },
            cache.rule.staleTimeout);
        }

        // Generate new value

        generateFunc(function (err, value, ttl) {

            // Check if already sent stale value

            if (wasCallbackCalled) {
                if (err) {

                    // Invalidate cache

                    cache.drop(key, function (cacheErr) {

                        log(['cache', 'drop'], null, cacheErr);
                    });
                }
                else {
                    // Replace stale cache copy with late-coming fresh copy
                    internals.saveToCache(cache, key, log, value, ttl);
                }

                return;
            }

            // New value (arrived before stale timeout if enabled)

            wasCallbackCalled = true;

            // Save to cache (lazy) and continue
            internals.saveToCache(cache, key, log, value, ttl);
            return callback(value);
        });
    });
};


