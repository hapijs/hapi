// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


internals.getCached = function (cache, key, logFunc, tags, callback) {

    // Check if cache enabled

    if (!cache.isMode('server')) {
        return callback();
    }

    // Lookup in cache

    var timer = new Utils.Timer();
    cache.get(key, function (err, cached) {

        if (err) {
            logFunc(tags.concat(['cache', 'get', 'error']), err.message);
            return callback();
        }

        if (!cached ||
            !cached.item) {

            // Not found (or invalid)
            logFunc(tags.concat(['cache', 'get']), { msec: timer.elapsed() });
            return callback();
        }

        logFunc(tags.concat(['cache', 'get']), { msec: timer.elapsed(), stored: cached.stored, ttl: cached.ttl, isStale: cached.isStale });
        return callback(cached);
    });
};


internals.saveToCache = function (cache, key, logFunc, tags, value, ttl) {

    if (!cache.isMode('server')) {
        return;
    }

    // Lazy save

    var timer = new Utils.Timer();
    cache.set(key, value, ttl, function (err) {

        if (err) {
            logFunc(tags.concat(['cache', 'set', 'error']), { msec: timer.elapsed(), error: err.message });
        }
        else {
            logFunc(tags.concat(['cache', 'set'], { msec: timer.elapsed() }));
        }
    });
};


exports.process = function (cache, key, logFunc, tags, generateFunc, callback) {

    // Get from cache

    internals.getCached(cache, key, logFunc, tags, function (cached) {

        // Check if found and fresh

        if (cached &&
            !cached.isStale) {

            return callback(cached.item, cached);
        }

        // Not in cache, or cache stale

        var wasCallbackCalled = false;                                      // Track state between stale timeout and generate fresh

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

                        if (cacheErr) {
                            logFunc(tags.concat(['cache', 'drop', 'error']), cacheErr.message);
                        }
                        else {
                            logFunc(tags.concat(['cache', 'drop']));
                        }
                    });
                }
                else {
                    // Replace stale cache copy with late-coming fresh copy
                    internals.saveToCache(cache, key, logFunc, tags, value, ttl);
                }

                return;
            }

            // New value (arrived before stale timeout if enabled)

            wasCallbackCalled = true;

            // Save to cache (lazy) and continue
            internals.saveToCache(cache, key, logFunc, tags, value, ttl);
            return callback(value);
        });
    });
};


