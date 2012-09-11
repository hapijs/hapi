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
- `monitor`
- `authentication`
- `cache`
- `debug`
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
- `isTrailingSlashSensitive` - determines whether the paths '/example' and '/example/' are considered different resources. Defaults to `false`.
- `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to 'true'.

### Payload

The `payload` option controls how incoming payloads (request body) are processed. Payload options:
- `maxBytes` - limits the size of incoming payloads to the specified bytes count. Allowing very large payloads may cause the server to run out of memory. Defaults to 1MB.

### Extensions

**hapi** does not support middleware extensiblity as is commonly found in other web frameworks. Instead, **hapi** provides 5 extension hooks for
 any application-specific functionality. Each extension point accepts a single function or an array of functions to be execute at a specified time
during request processing. The required extension function signature is `function (request, next)` where:
- `request` is the **hapi** request object, and
- `next` is the callback function the method must call upon completion to return control over to the router.

The extension points are:
- `onRequest` - called upon new requests before any router processing. Calls to `request.setUrl()` will impact how the request is router and can be used for rewrite rules.
- `onPreHandler` - called after request passes validation and body parsing, before the request handler.
- `onPostHandler` - called after the request handler, before sending the response.
- `onPostRoute` - called after the response was sent.
- `onUnknownRoute` - if defined, overrides the default unknown resource (404) error response. The method must send the response manually via `request.raw.res`. Cannot be an array.

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

### CORS

The [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows browsers to make cross-origin API calls. This is required
by web application running inside the browser which are loaded from a different domain than the API server. **hapi** provides a general purpose
CORS implementation that sets very liberal restrictions on cross-origin access by default. CORS options:
- `maxAge` - number of seconds the browser should cache the CORS response. The greater the value, the longer it will take before the browser checks for changes in policy. Defaults to one day.

### Routes

#### Configuration options

* `path` - endpoint (see [Director](https://github.com/flatiron/director "Director") for endpoint matching patterns )
* `method` - http method for routing endpoint
* `handler` - Function to handle request
* `authentication` - Type of authentication
* `tos` - Terms of Service required for that request
* `query` -
* `schema` -
* `scope` -

#### Wildcards

Wildcard declaration in routes are handled the same way as they are in Director or Express. Their retrieval on the handler is handled a little differently.

```js
//when you add a route like this:
server.addRoute({
path : '/luna/:album',
method : 'GET',
handler : albumRetrieve,
authentication: 'none'
});

function albumRetrieve(hapi, reply) {
//hapi.params will have the parameter
console.log(hapi.params.album);
reply(albumGet(hapi.params.album));
}
```

### Handlers

Each handler needs two parameters, usually named 'hapi' and 'reply'.

* `hapi` - the first parameter. provides request information
* `reply` - function to call that takes a json body as a response

### Middleware

hapi provides a few places where middleware can be added into the functions being called for each request. They are:

* `onPreRoute` - gets called before the request is routed.
* `onPreHandler` - gets called after the request has been routed before the assigned handler is called
* `onPostHandler` - gets called after the request headers
* `onPostRoute` - called after all the routes have been matched

Add them via the 'ext' portion  of the options.

```js
var server = new hapi.Server.Server('localhost', 8088, {name:'sample', uri:'0.0.0.0', ext: {onPreRoute:myPreRouteFunction}});
```

### Utils

hapi provides a myriad of util functions for your use
* `abort(message)` - logs message to console and exits the process.
* `clone(obj)` - clones an object or array
* `getTimeStamp()` - gives a 'now' timestamp
* `hide(object, definition)` - removes hidden keys
* `map(array, key)` - turns an array into an object
* `merge(target, source)` - Merge all the properties of source into target; source wins in conflict
* `unique(array, key)` - removes duplicates from an array








