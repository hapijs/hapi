# Hapi Throttling

* Author: Wyatt Preul <wlyonpreul@walmart.com>

## Introduction

There is a need to add a feature that allows for limits to be imposed on how many requests can be made to hapi within a given timespan.  The requests may be limited for certain users only, therefore this feature needs to be very flexible.

## Limitations & Assumptions

The throttling feature will not, at this time, try to limit the upload size or bytes/sec of user requests.  Instead, it will be more narrowly focused on imposing limits on the frequency of API usage.  That being said, these limits will not, at this time, be assumed to vary per route.  In other words, the throttling will be done server wide instead of being configurable for each route.

## Rate Intervals

To keep things simple, rate intervals will not be configurable beyond a day.  Meaning, you can't impose weekly or monthly limits on usage.  Instead, daily, hourly, per minute, or per second limits can be configured only.  This is a decision made after surveying existing limits that exist on APIs, most of them are limits on a per hour basis.

## Usage Rate Handler

There will be an endpoint enabled by default when throttling is in use that returns the current request count and the remaining number of requests than can be made.  This should be useful for developers to discover what the server rates are.

## Configuration

By default, throttling will be disabled.  However, if a throttling configuration object is set when creating the server then throttling will be enabled.  To explicitly disable throttling, the throttling property on server settings should be set to _'false'_.  Below is an example of what a simple throttle configuration could look like:

```javascript
    throttle: {
        hourly: 5000
    }
```

The following configuration options are all available.  However, only one frequency should be chosen to keep things simple:

```
    daily,
    hourly,
    perMinute,
    perSecond
```

### Custom Limit Checking

The above assumes that all users on the server have the same limits.  However, if a per-user limits need to be imposed you can override the throttle validation function like the following:

```javascript
    throttle: {
        islimitReachedFunc: islimitReached
    }
```

And the limitReachedFunc will have the following signature:

```javascript
    function(request, callback)
```

This allows for more complicated throttling scenarios where limits may need to be imposed on certain users, and potentially for certain routes only.  In the example, _'request'_ will have the throttle object saved on as a property at _'request.throttle'_.  An implementation for _'islimitReached'_ could look like the following:

```javascript
    function(request, callback) {

        mongo.getUsage(request.session, function(err, currentUsage) {

            return (currentUsage > request.throttle.hourly) ? callback(err, true) : callback(err, false);
        });
    }
```

### Role Based Limits

When implementing custom user checks, this configuration can be expanded into a more complex structure.  Assume that you have a role based usage rules policy, then the following configuration may apply:

```javascript
    throttle: {
        roles: {
            'admin': {
                hourly: 10000
            },
            'dev': {
                hourly: 5000
            },
            'anonymous': {
                hourly: 500
            }
        },
        islimitReachedFunc: islimitReached
    }
```

### Data Storage

Since throttling will require a persistent storage for API usage tracking, it will need to have a similar configuration as caching.  However, because caching may use a different storage device than throttling, the setup of the throttle data store should be separate.  The _'throttle'_ configuration should have the following options, similar to the _'cache'_ configuration:

```javascript
    engine,
    host,
    port,
    segment
```

### Sliding Expiration

Finally, a configuration option will also need to exist to indicate if a sliding expiration should be used.  By default _'slidingExpiration'_ will be disabled, so that an hour limit will be from the beginning of an hour to the end.  That is to say, when sliding expiration is disabled when an hour changes on the servers clock the usage for a user will be reset.  When sliding expiration is enabled, however, as soon as a user first makes a request then the usage tracking will start.

## Tracking Usage

When throttling is enabled, every request will need to increment its respected usage count.  However, not every use will necessarily require throttling limits be imposed, therefore a custom function can be added to the throttle configuration to determine if a user is tracked.  Below is what this entry in the configuration++ will look like:

```javascript
    throttle: {
        isTracked
    }
```

The function signature looks like the following:

```javascript
    function(request, callback)
```

The callback expects an error and boolean value like the following signature: _'(err, true)'_.  This will be used to indicate if the user should be tracked.  This can also be useful if not all routes will increment the usage count, like reading documentation for example.

When it is determined that a request should increment the usage counter for the user then a cache level usage counter will be incremented.  At some defined interval the cache usage counts will be flushed and added to the permanent usage counts in storage.  Perhaps this behavior should be optional and the default will auto-update the throttle storage.
