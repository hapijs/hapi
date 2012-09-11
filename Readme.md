<img src="https://raw.github.com/walmartlabs/hapi/master/images/hapi.png" />

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documenentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of speding time
with everything else.

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

# Usage

## Basic Usage

The following is a simple "hello world" service with a single API endpoint:

```javascript
var Hapi = require('hapi');

// Create a server with a host, port, and options
var server = new Hapi.Server('localhost', 8000);

// Define the route
var hello = {
handler: function (request) {

        request.reply({ greeting: 'hello world' });
    }
};

// Add the route
server.addRoute({
    method : 'GET',
    path : '/hello',
    config : hello
});

// Start the server
server.start();
```

Now navigate to http://localhost:8080/hello and you should receive 'hello world'.

## Server Configration

**hapi** provides a rich set of configuration options for each server instance:

- [`tls`](#tls)
- [`router`](#router)
- [`payload`](#payload)
- [`ext`](#extensions)
- [`monitor`](#monitor)
- [`authentication`](#authentication)
- [`cache`](#cache)
- [`debug`](#debug)
- [`cors`](#cors)

### TLS

**hapi** creates an HTTP server by default. To create an HTTPS server, include the `tls` object in the server configuration.
The `tls` object is passed unchanged to the node.js HTTPS server and described in the
[node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

```javascript
var Hapi = require('hapi');

// Server options
var options = {
    tls: {
        key: 'your_key',
        cert: 'your_cert'
    }
};

// Create a server with a host, port, and options
var server = new Hapi.Server('localhost', 8000, options);
```

### Router

The `router` option controls how incoming request URIs are matched against the routing table. Router options:
- `isTrailingSlashSensitive` - determines whether the paths '/example' and '/example/' are considered different resources. Defaults to _false_.
- `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to _true_.

### Payload

The `payload` option controls how incoming payloads (request body) are processed. Payload options:
- `maxBytes` - limits the size of incoming payloads to the specified bytes count. Allowing very large payloads may cause the server to run out of memory. Defaults to _1MB_.

### Extensions

**hapi** does not support middleware extensiblity as is commonly found in other web frameworks. Instead, **hapi** provides 5 extension hooks for
 any application-specific functionality. Each extension point accepts a single function or an array of functions to be execute at a specified time
during request processing. The required extension function signature is _function (request, next)_ where:
- `request` is the **hapi** request object, and
- `next` is the callback function the method must call upon completion to return control over to the router.

The extension points are:
- `onRequest` - called upon new requests before any router processing. Calls to _request.setUrl()_ will impact how the request is router and can be used for rewrite rules.
- `onPreHandler` - called after request passes validation and body parsing, before the request handler.
- `onPostHandler` - called after the request handler, before sending the response.
- `onPostRoute` - called after the response was sent.
- `onUnknownRoute` - if defined, overrides the default unknown resource (404) error response. The method must send the response manually via _request.raw.res_. Cannot be an array.

For example:
```javascript
var Hapi = require('hapi');

var options = {
    ext: {
        onRequest: onRequest,
        onUnknownRoute: onUnknownRoute
    }
};

// Create server
var http = new Hapi.Server('localhost', 8000, options);

// Set routes
http.addRoute({ method: 'GET', path: '/test', handler: get });

// Start server
http.start();

// Resource handler
function get(request) {

    request.reply({ status: 'ok' });
};

// Path rewrite
function onRequest(request, next) {

    // Change all requests to '/test'
    request.setUrl('/test');
    next();
};

// 404 handler
function onUnknownRoute(request, next) {

    request.raw.res.writeHead(404);
    request.raw.res.end();
    next();
};
```

### Monitor

**hapi** comes with a built-in process monitor for three types of events:
- System and process performance (ops) - CPU, memory, disk, and other metrics.
- Requests logging (request) - framework and application generated logs generated during the lifecycle of each incoming request.
- General events (log) - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc.

The monitor is off by default and can be turned on using the `monitor` server option. To use the default settings, simply set the value to _true_.
To override some or all of the defaults, set `monitor` to an object with the following optional settings:
- `broadcastInterval` - the interval in miliseconds to send collected events to subscribers. _0_ means send immediately. Defaults to _0_.
- `opsInterval` - the interval in miliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `extendedRequests` - boolean, determines if the full request log is sent or only the event summary. Defaults to _false_.
- `subscribers` - an object where each key is a destination and each value an array subscriptions. Subscriptions available are _ops_, _requests_, and _log_. The destination can be a URI or _console_. Defaults to a console subscription to all three.

For example:
```javascript
var options = {
    monitor: {
        subscribers: {
            console: ['ops', 'request', 'log'],
            'http://localhost/logs': ['log']
        }
    }
};
```

### Authentication

The authentication interface is disabled by default and is still experimental.

### Cache

### Debug

### CORS

The [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows browsers to make cross-origin API calls. This is required
by web application running inside a browser which are loaded from a different domain than the API server. **hapi** provides a general purpose
CORS implementation that sets very liberal restrictions on cross-origin access by default (on by default). CORS options:
- `origin` - override the array of allowed origin servers ('Access-Control-Allow-Origin'). Defaults to any origin _'*'_.
- `maxAge` - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser checks for changes in policy. Defaults to _one day_.
- `headers` - overrid the array of allowed headers ('Access-Control-Allow-Headers'). Defaults to _'Authorization, Content-Type, If-None-Match'_.
- `additionalHeaders` - an array of additional headers to `headers`. Use this to keep the default headers in place.
- `methods` - override the array of allowed methods ('Access-Control-Allow-Methods'). Defaults to _'GET, HEAD, POST, PUT, DELETE, OPTIONS'_.
- `additionalMethods` - an array of additional methods to `methods`. Use this to keep the default methods in place.

**hapi** will automatically add an _OPTIONS_ handler for every route unless disabled. To disable CORS for the entire server, set the `cors` server option to _false_. To disable CORS support for a single route, set the route _config.cors_ option to _false_.

## Route Configuration

### Configuration options

* `path` - endpoint (see [Director](https://github.com/flatiron/director "Director") for endpoint matching patterns )
* `method` - http method for routing endpoint
* `handler` - Function to handle request
* `authentication` - Type of authentication
* `tos` - Terms of Service required for that request
* `query` -
* `schema` -
* `scope` -

### Wildcards

Wildcard declaration in routes are handled the same way as they are in Director or Express. Their retrieval on the handler is handled a little differently.

```js
//when you add a route like this:
server.addRoute({
    path : '/luna/:album',
    method : 'GET',
    handler : albumRetrieve,
    authentication: 'none'
});

function albumRetrieve(request) {
    //hapi.params will have the parameter
    request.reply(albumGet(hapi.params.album));
}
```

## Utilities

hapi provides a myriad of util functions for your use
* `abort(message)` - logs message to console and exits the process.
* `clone(obj)` - clones an object or array
* `getTimeStamp()` - gives a 'now' timestamp
* `hide(object, definition)` - removes hidden keys
* `map(array, key)` - turns an array into an object
* `merge(target, source)` - Merge all the properties of source into target; source wins in conflict
* `unique(array, key)` - removes duplicates from an array








