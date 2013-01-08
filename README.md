<a href="/walmartlabs/blammo"><img src="https://raw.github.com/walmartlabs/blammo/master/images/from.png" align="right" /></a>
![hapi Logo](https://raw.github.com/walmartlabs/hapi/master/images/hapi.png)

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

Current version: **0.11.0**

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)


# Table of Content

- [**Usage**](#usage)
    - [**Basic Usage**](#basic-usage)
<p></p>
    - [**Server Construction**](#server-construction)
<p></p>
    - [**Server Configuration**](#server-configuration)
        - [TLS](#tls)
        - [Router](#router)
        - [Payload](#payload)
        - [Extensions](#extensions)
            - [Unknown Route](#unknown-route)
        - [Format](#format)
          - [Error Format](#error-format)
          - [Payload Format](#payload-format)
        - [Files](#files)
        - [Monitor](#monitor)
        - [Authentication](#authentication)
        - [Cache](#cache)
        - [Debug](#debug)
        - [CORS](#cors)
        - [Batch](#batch)
        - [State](#state)
<p></p>
    - [**Server Events**](#server-events)
<p></p>
    - [**Route Configuration**](#route-configuration)
        - [Configuration options](#configuration-options)
        - [Override Route Defaults](#override-route-defaults)
        - [Path Processing](#path-processing)
            - [Parameters](#parameters)
        - [Route Handler](#route-handler)
            - [Response](#response)
            - [Proxy](#proxy)
            - [File](#file)
            - [Directory](#directory)
            - [Views](#views)
            - [Docs](#documentation)
            - [Request Logging](#request-logging)
        - [Query Validation](#query-validation)
        - [Payload Validation](#payload-validation)
        - [Path Validation](#path-validation)
        - [Response Validation](#response-validation)
        - [Caching](#caching)
        - [Route Prerequisites](#route-prerequisites)
<p></p>
    - [**Data Validation**](#data-validation)
<p></p>
    - [**Response Errors**](#response-errors)
<p></p>
    - [**State Management**](#state-management)
        - [Raw Cookies](#raw-cookies)
<p></p>
    - [**General Events Logging**](#general-events-logging)
<p></p>
    - [**Request Tails**](#request-tails)
<p></p>
    - [**Request Injection**](#request-injection)
<p></p>
    - [**Server Helpers**](#server-helpers)


# Usage


## Basic Usage

The following is a simple "hello world" service with a single API endpoint:

```javascript
var Hapi = require('hapi');

// Create a server with a host and port
var server = new Hapi.Server('localhost', 8000);

// Define the route
var hello = {
    handler: function (request) {
    
        request.reply({ greeting: 'hello world' });
    }
};

// Add the route
server.addRoute({
    method: 'GET',
    path: '/hello',
    config: hello
});

// Start the server
server.start();
```

Now navigate to http://localhost:8000/hello and you should receive 'hello world'.


## Server Construction

The **hapi** Server object is the core of the framework and is constructed by instantiating a new Server object with the following optional parameters:
- _'host'_ - optional host name. Defaults to 'localhost'.
- _'port'_ - optional port. Defaults to '80' (or '443' for TLS).
- _'options'_ - optional configuration as described in [Server Configuration](#server-configuration).

```javascript
var Hapi = require('hapi');

// Create a server on localhost port 80
var server = new Hapi.Server();
```


## Server Configuration

**hapi** provides a rich set of configuration options for each server instance:

- [`tls`](#tls)
- [`router`](#router)
- [`payload`](#payload)
- [`ext`](#extensions)
- [`format`](#format)
- [`files`](#files)
- [`monitor`](#monitor)
- [`authentication`](#authentication)
- [`cache`](#cache)
- [`debug`](#debug)
- [`cors`](#cors)
- [`batch`](#batch)
- [`state`](#state)


### TLS

**hapi** creates an HTTP server by default. To create an HTTPS server, include the `tls` object in the server configuration.
The `tls` object is passed unchanged to the node.js HTTPS server and described in the
[node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

```javascript
var Hapi = require('hapi');

var options = {
    tls: {
        key: 'your_key',
        cert: 'your_cert'
    }
};

var server = new Hapi.Server(options);
```


### Router

The `router` option controls how incoming request URIs are matched against the routing table. The router only uses the first match found. Router options:
- `isTrailingSlashSensitive` - determines whether the paths '/example' and '/example/' are considered different resources. Defaults to _false_.
- `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to _true_.
- `normalizeRequestPath` - determines whether a path should have certain reserved and unreserved percent encoded characters decoded.  Also, all percent encodings will be capitalized that cannot be decoded.  Defaults to _false_.


### Payload

The `payload` option controls how incoming payloads (request body) are processed. Payload options:
- `maxBytes` - limits the size of incoming payloads to the specified bytes count. Allowing very large payloads may cause the server to run out of memory. Defaults to _1MB_.


### Extensions

**hapi** does not support middleware extensibility as is commonly found in other web frameworks. Instead, **hapi** provides extension hooks for
any application-specific functionality. Each extension point accepts a single function or an array of functions to be execute at a specified stage
during request processing. The required extension function signature is _function (request, next)_ where:
- _'request'_ is the **hapi** request object, and
- _'next'_ is the callback function the method **must** call upon completion to return control over to the router.

The extension points are:
- `onRequest` - called upon new requests before any router processing. The _'request'_ object passed to the `onRequest` functions is decorated with the _'setUrl(url)'_ and _'setMethod(verb)' methods. Calls to these methods will impact how the request is router and can be used for rewrite rules.
- `onPreHandler` - called after request passes validation and body parsing, before the request handler.
- `onPostHandler` - called after the request handler, before sending the response. The actual state of the response depends on the response type used (e.g. direct, stream).
- `onPostRoute` - called after the response was sent.
- `onUnknownRoute` - if defined, overrides the default unknown resource (404) error response. The method must send the response manually via _request.raw.res_. Cannot be an array.

For example:
```javascript
var Hapi = require('hapi');

var options = {
    ext: {
        onRequest: onRequest
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
}

// Path rewrite
function onRequest(request, next) {

    // Change all requests to '/test'
    request.setUrl('/test');
    next();
}
```


#### Unknown Route

**hapi** provides a default handler for unknown routes (HTTP 404). If the application needs to override the default handler, it can use the
`ext.onUnknownRoute` server option. The extension function signature is _function (request)_ where:
- _'request'_ is the **hapi** request object.

When the extension handler is called, the _'request'_ object is decorated as described in [Route Handler](#route-handler) with the following additional method:
- _'reply.close()'_ - returns control over to the server after the application has taken care of responding to the request via the _request.raw.res_ object directly.

The method **must** return control over to the route using the _reply_ interface described in [Route Handler](#route-handler) or the _'reply.close()'_ method but not both.

For example, using the _'reply.close()'_ method:
```javascript
var Hapi = require('hapi');

var options = {
    ext: {
        onUnknownRoute: onUnknownRoute
    }
};

// Create server
var http = new Hapi.Server('localhost', 8000, options);

// Start server
http.start();

// 404 handler
function onUnknownRoute(request) {

    request.raw.res.writeHead(404);
    request.raw.res.end();
    request.reply.close();
}
```

Or using the _'reply(result)'_ method:
```javascript
function onUnknownRoute(request) {

    request.reply({ roads: 'ocean' });
}
```


### Format

The `format` option provides an extension point for use of custom methods to format error responses or payloads before they are sent back to the client.


#### Error Format

If a different error format than the default JSON response is required, the server `format.error` option can be assigned a function to generate a
different error response. The function signature is _'formatted = function (result)'_ where:
- _'result'_ - is the **hapi** error object returned by the route handler, and
- _'formatted'_ - is the formatted response object which contains the following keys:
    - _`code`_ - the HTTP status code.
    - _`payload`_ - the response payload.
    - _`type`_ - the response payload content-type.
    - _`headers`_ - any additional response HTTP headers (object).

Note that the format function must be synchronous.

For example:
```javascript
var options = {
    format: {
        error: function (result) {
        
            return { code: 500, payload: 'Oops: ' + result.message, type: 'text/html' };
        }
    }
};
```


#### Payload Format

In cases where every non-error payload has to be processed before being sent out (e.g. when returning a database object and need to hide certain fields or
rename '_id' to 'id'), the `format.payload' option can be set to a function that is called on every result, immediately after 'request.reply' is called. The
function's signature is _'formatted = function (result)'_ where:
- _'result'_ - is the raw result object returned by the route handler, and
- _'formatted'_ - is the formatted response to replace 'result'.

Note that the format function must be synchronous, and it is only invoked for response types other than Stream.

For example:
```javascript
var options = {
    format: {
        payload: function (result) {
        
            return 'something else instead';
        }
    }
};
```


### Files

**hapi** provides built-in support for serving static files and directories as described in [File](#file) and [Directory](#directory).
When these handlers are provided with relative paths, the `files.relativeTo` server option determines how these paths are resolved
and defaults to _'routes'_:
- _'routes'_ - relative paths are resolved based on the location of the files in which the server's _'addRoute()'_ or _'addRoutes()'_ methods are called. This means the location of the source code determines the location of the static resources when using relative paths.
- _'process'_ - relative paths are resolved using the active process path (_'process.cwd()'_).


### Monitor

**hapi** comes with a built-in process monitor for three types of events:
- System and process performance (ops) - CPU, memory, disk, and other metrics.
- Requests logging (request) - framework and application generated logs generated during the lifecycle of each incoming request.
- General events (log) - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc. Described in [General Events Logging](#general-events-logging).

The monitor is _off_ by default and can be turned on using the `monitor` server option. To use the default settings, simply set the value to _true_.
Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination as general events (log)
are a process-wide facility and will result in duplicated log events. To override some or all of the defaults, set `monitor` to an object with the following
optional settings:
- `broadcastInterval` - the interval in milliseconds to send collected events to subscribers. _0_ means send immediately. Defaults to _0_.
- `opsInterval` - the interval in milliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `extendedRequests` - determines if the full request log is sent or only the event summary. Defaults to _false_.
- `requestsEvent` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `subscribers` - an object where each key is a destination and each value an array subscriptions. Subscriptions available are _ops_, _request_, and _log_. The destination can be a URI or _console_. Defaults to a console subscription to all three.

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

**hapi** provides a built-in caching facility for storing and reusing request responses and helpers utilities. The provided implementations include Redis and MongoDB support
(each must be manually installed and configured). The cache functionality is _off_ by default. To enable caching, the `cache` option must be set to
an object with the following options:
- `engine` - the cache server implementation. Options are _redis_, _mongodb_, and _memory_.
- `host` - the cache server hostname.
- `port` - the cache server port.
- `partition` - the partition name used to isolate the cached results across different servers. Defaults to 'hapi-cache'.
- `username`, `password`, `poolSize` - MongoDB-specific options.

For convenience, pre-configured options are provided for Redis, MongoDB, and an experimental memory store. To use them, simply set the server's `cache` option to:
- _'redis'_ - Connects to _127.0.0.1:6379_ using partition name 'hapi-cache'.
- _'mongodb'_ - Connects to _127.0.0.1:27017_ using partition name 'hapi-cache', no authentication, and pool size 5.
- _'memory'_ - This is an experimental engine and should be avoided in production environments.  The memory engine will run within the node process and supports the following option:
    - `maxByteSize` - Sets an upper limit on the number of bytes that can be consumed by the total of everything cached in the memory engine.  Once this limit is reached no more items will be added to the cache.

For example:
```javascript
var options = {
    cache: 'redis'
};
```

Enabling the server cache only creates the cache interface but does not enable caching for any individual routes or helpers, which must be enabled
and configured in the route or helper configuration.


### Debug

To assist in debugging server events related to specific incoming requests, **hapi** includes an optional debug console which is turned _off_ by default.
The debug console is a simple web page in which developers can subscribe to a debug id, and then include that debug id as an extra query parameter in each
request. The server will use WebSocket to stream the subscribed request logs to the web page in real-time. In application using multiple server instances,
only one can enable the debug interface using the default port. To enable the debug console set the `debug` option to _true_ or to an object with custom
configuration:
- `websocketPort` - the port used by the WebSocket connection. Defaults to _3000_.
- `debugEndpoint` - the debug console request path added to the server routes. Defaults to _'/debug/console'_.
- `queryKey` - the name or the request query parameter used to mark requests being debugged. Defaults to _debug_.


### CORS

The [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows browsers to make cross-origin API calls. This is required
by web application running inside a browser which are loaded from a different domain than the API server. **hapi** provides a general purpose
CORS implementation that sets very liberal restrictions on cross-origin access by default (on by default). CORS options:
- `origin` - overrides the array of allowed origin servers ('Access-Control-Allow-Origin'). Defaults to any origin _'*'_.
- `maxAge` - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser checks for changes in policy. Defaults to _one day_.
- `headers` - overrides the array of allowed headers ('Access-Control-Allow-Headers'). Defaults to _'Authorization, Content-Type, If-None-Match'_.
- `additionalHeaders` - an array of additional headers to `headers`. Use this to keep the default headers in place.
- `methods` - overrides the array of allowed methods ('Access-Control-Allow-Methods'). Defaults to _'GET, HEAD, POST, PUT, DELETE, OPTIONS'_.
- `additionalMethods` - an array of additional methods to `methods`. Use this to keep the default methods in place.

**hapi** will automatically add an _OPTIONS_ handler for every route unless disabled. To disable CORS for the entire server, set the `cors` server option to _false_. To disable CORS support for a single route, set the route _config.cors_ option to _false_.


### Batch

The batch endpoint makes it easy to combine requests into a single one.  It also supports pipelining so you are able to take the result of one of the endpoints in the batch request and use it in a subsequent endpoint.  The batch endpoint only responds to POST requests.
By default the batch endpoint is turned _off_.  To enable the batch endpoint set the `batch` option to _true_ or to an object with the following custom configuration:
- `batchEndpoint` - the path where batch requests will be served from.  Default is '/batch'.

As an example to help explain the use of the endpoint, assume that the server has a route at '/currentuser' and '/users/{id}/profile/'.  You can make a POST request to the batch endpoint with the following body:
`{ "requests": [ {"method": "get", "path": "/currentuser"}, {"method": "get", "path": "/users/$0.id/profile"} ] }` and it will return an array with the current user and their profile.

The response body to the batch endpoint is an ordered array of the response to each request.  Therefore, if you make a request to the batch endpoint that looks like `{ "requests": [ {"method": "get", "path": "/users/1"}, {"method": "get", "path": "/users/2"} ] }` the response might look like:
`[{"userId": "1", "username": "bob"}, {"userId": "2", "username": "billy" }]` where the first item in the response array is the result of the request from the first item in the request array.

If an error occurs as a result of one the requests to an endpoint it will be included in the response in the same location in the array as the request causing the issue.  The error object will include an error property that you can interrogate.  At this time the response is a 200 even when a request in the batch returns a different code.

*** At this time batch only supports requests to routes that use the GET method.


### State

HTTP state management (cookies) allows the server to store session information on the client which is sent back to the server with every
request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)). **hapi** will automatically parse incoming cookies based on the
server's `state.cookies` configuration, where:
- `parse` - determines is incoming 'Cookie' headers are parsed and stored in the 'request.cookies' object. Defaults to true.
- _'failAction'_ - allowed values are: _'error'_ (return 500), _'log'_ (report error but continue), or _'ignore'_ (continue) when a request cookie fails parsing. Defaults to _'error'_.


## Server Events

The server object emits the following events:
- _'response'_ - emitted after a response is sent back. Includes the request object as value.
- _'tail'_ - emitted when a request finished processing, including any registered tails as described in [Request Tails](#request-tails).


## Route Configuration

**hapi** was designed to move as much logic as possible from the route handler to the route configuration. The goal is to provide a simple
mechanism for defining routes without having to write code. This approach also enables producing dynamic route documentation without having
to write additional text as the configuration itself serves as a living documentation.


### Configuration options 

- `path` - the absolute path or regular expression to match against incoming requests. Path comparison is configured using the server [`router`](#router) option. String paths can include named identifiers enclosed in _'{}'_ as described in [Path Parameters](#path-processing).
- `method` - the HTTP method. Typically one of _'GET, POST, PUT, DELETE, OPTIONS'_. Any HTTP method is allowed, except for _'HEAD'_. **hapi** does not provide a way to add a route to all methods.
- `handler` - the business logic function called after authentication and validation to generate the response. The function signature is _function (request)_ where _'request'_ is the **hapi** request object. See [Route Handler](#route-handler) for more information.  Optionally, this can be an object with a _'proxy'_, _'file'_, or _'directory'_ property:
    - `proxy` - generates a reverse proxy handler as described in (Proxy)[#proxy].
    - `file` - generates a static file endpoint as described in (File)[#file].
    - `directory` - generates a directory mapper for service static content as described in (Directory)[#directory].
- `config` - route configuration grouped into a sub-object to allow splitting the routing table from the implementation details of each route. Options include:
    - `description` - route description.
    - `notes` - route notes (string or array of strings).
    - `tags` - route tags (array of strings).
    - `handler` - an alternative location for the route handler function. Same as the `handler` option in the parent level. Can only include one handler per route.
    - `validate`
        - `query` - validation rules for incoming requests' query component (the key-value part of the URI between _?_ and _#_). Defaults to any query parameters being allowed. See [Query Validation](#query-validation) for more information.
        - `schema` - validation rules for incoming requests' payload (request body). Defaults to no validation (any payload allowed). Set to _'false'_ to forbid payloads. See [Payload Validation](#payload-validation) for more information.
        - `path` - validation rules for incoming requests' path parameters. Defaults to no validation (any path parameter allowed). Set to _'false'_ to forbid any path parameter. See [Path Validation](#path-validation) for more information.
    - `response` - validation rules for outgoing responses' payload (response body). Defaults to no validation (any payload allowed). Set to an empty object _'{}'_ to forbid payloads. See [Response Validation](#response-validation) for more information.
    - `payload` - determines how the request payload is processed. Defaults to _'parse'_ if `schema` is present or `method` is _'POST'_ or _'PUT'_, otherwise _'stream'_. Payload processing is configured using the server [`payload`](#payload) option. Options are:
        - _'stream'_ - the incoming request stream is left untouched, leaving it up to the handler to process the request via _'request.raw.req'_. Note that the request readable stream is put in a paused state and must be resumed before it will emit data events.
        - _'raw'_ - the payload is read and stored in _'request.rawBody'_ but not parsed.
        - _'parse'_ - the payload is read and stored in _'request.rawBody'_ and then parsed (JSON or form-encoded) and stored in _'request.payload'_.
    - `cache` - if the server `cache` option is enabled and the route method is 'GET', the route can be configured to use the cache as described in [Caching](#caching).
    - `pre` - an array with pre-handler methods as described in [Route Prerequisites](#route-prerequisites). 
    - `auth` - authentication configuration
        - `mode` - the authentication mode. Defaults to _'required'_ is the `authentication` server option is set, otherwise _'none'_. Available options include:
            - _'none'_ - authentication not allowed.
            - _'required'_ - authentication is required.
            - _'optional'_ - authentication is optional (validated if present).
        - `tos` - minimum terms-of-service version required. This is compared to the terms-of-service version accepted by the user. Defaults to _none_.
        - `scope` - required application scope. Defaults to _none_.
        - `entity` - the required authenticated entity type. Not supported with every authorization scheme. Available options include:
            - _'any'_ - the authentication can be on behalf of a user or application.
            - _'user'_ - the authentication must be on behalf of a user.
            - _'app'_ - the authentication must be on behalf of an application.

The `config` option was defined for easily spliting the routing table definition from the individual route information. For example:
```javascript
var Hapi = require('hapi');

var server = new Hapi.Server();

// Option 1 - add handler directly in route definition

var handler1 = function (request) {

    request.reply('ok');
}

server.addRoute({ method: 'GET', path: '/option1', handler: handler1 });

// Option 2 - add handler in separate config object

var config2 = {
    payload: 'raw',
    // ... additional config options ...
    handler: function (request) {

        request.reply('ok');
    }
};

server.addRoute({ method: 'GET', path: '/option2', config: config2});
```


### Override Route Defaults

Each configuration option comes with a built-in default. To change these defaults, use the `setRoutesDefaults()` server method.
```javascript
server.setRoutesDefaults({
    cors: false
});
```


### Path Processing

The **hapi** router iterates through the routing table on each incoming request and executes the first (and only the first) matching route handler.
Route matching is done on the request path only (excluding the query and other components). The route `path` option support three types of paths:
- Static - the route path is a static string which begin with _'/'_ and will only match incoming requests containing the exact string match (as defined by the server `router` option).
- Parameterized - same as _static_ with the additional support of named parameters (enclosed in _'{}'_).


#### Parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming request path at that level. For example, the route:
'/book/{id}/cover' will match: '/book/123/cover' and 'request.params.id' will be set to '123'. Each path level (everything between the opening _'/'_ and
 the closing _'/'_ unless it is the end of the path) can only include one named parameter. The _'?'_ suffix following the parameter name indicates
an optional parameter (only allowed if the parameter is at the ends of the path). For example: the route: '/book/{id?}' will match: '/book/' (and may
match '/book' based on the server `router` option).

```javascript
server.addRoute({
    path: '/{album}/{song?}',
    method: 'GET',
    handler: getAlbum
});

function getAlbum(request) {

    request.reply('You asked for ' +
                  (request.params.song ? request.params.song + ' from ' : '') +
                  request.params.album);
}
```

In addition to the optional _'?'_ suffix, a param can also specify an expected number of parts in the path.  To do this use the _'*'_ suffix followed by a number greater than 1.  If the number of expected parts can be anything, then use the _'*'_ without a number.

```javascript
server.addRoute({
    path: '/person/{names*2}',
    method: 'GET',
    handler: getPerson
});

function getPerson(request) {

    var nameParts = request.params.names.split('/');
    request.reply(new Person(namesParts[0], nameParts[1]));
}
```

In the example code above if a request for `/person/john/smith` comes in then `request.params.names` is set to 'john/smith'.  In this example a person will be returned for the john smith.

Below is a similar example without a requirement on the number of name parts that can be passed.

```javascript
server.addRoute({
    path: '/people/{names*}',
    method: 'GET',
    handler: getPerson
});

function getPeople(request) {

    var nameParts = request.params.names.split('/');
    request.reply(loadPeople(namesParts));
}
```

In the example people are loaded by passing in a names array.  If a request comes in for `people/john/bob/jenny` then `request.params.names` is set to 'john/bob/jenny'.  Please note that the route will be matched for a request of `/people/` as names can be 0 or more parts.  As a result of this behavior, {names*} must appear as the last parameter in the route path.  In other words, a param with 0 or more path parts must appear at the end of the end of the route path.


### Route Handler

When the provided route handler method is called, it receives a _request_ object with the following properties:
- _'url'_ - the parsed request URI.
- _'path'_ - the request URI's path component.
- _'method'_ - the request method as a _lowercase_ string. (Examples: `'get'`, `'post'`).
- _'query'_ - an object containing the query parameters.
- _'params'_ - an object containing the path named parameters as described in [Path Parameters](#parameters).
- _'rawBody'_ - the raw request payload (except for requests with `config.payload` set to _'stream'_).
- _'payload'_ - an object containing the parsed request payload (for requests with `config.payload` set to _'parse'_).
- _'state'_ - an object containing parsed HTTP state information (cookies).
- _'session'_ - available for authenticated requests and includes:
    - _'id'_ - session identifier.
    - _'used'_ - user id (optional).
    - _'app'_ - application id (optional).
    - _'scope'_ - approved application scopes (optional).
    - _'ext.tos'_ - terms-of-service version (optional).
- _'server'_ - a reference to the server object.
- _'pre'_ - any requisites as described in [Prequisites](#prequisites).
- _'addTail([name])'_ - adds a request tail as described in [Request Tails](#request-tails).
- _'raw'_ - an object containing the Node HTTP server 'req' and 'req' objects. **Direct interaction with these raw objects is not recommended.**


#### Response

**hapi** provides native support for the following response types:
- Empty - an empty response body (content-lenght of zero).
- Text - plain text. Defaults to 'text/html' content-type.
- Obj - Javascript object, converted to string. Defaults to 'application/json' content-type.
- Stream - a stream object, directly piped into the HTTP response.
- File - transmits a static file. Defaults to the matching mime type based on filename extension.
- Direct - special response type for writing directly to the response object. Used for chunked responses.
- Error - error objects generated using the 'Hapi.error' module or 'new Error()' described in [Response Errors](#response-errors).

The request object includes a _'reply'_ property which includes the following methods:
- _'payload(result)'_ - sets the provided _'result'_ as the response payload. _'result'_ cannot be a Stream. The method will automatically identify the result type and cast it into one of the supported response types (Empty, Text, Obj, or Error). _'result'_ can all be an instance of any other response type provided by the 'Hapi.response' module (e.g. File, Direct).
- _'stream(stream)'_ - pipes the content of the stream into the response.
- _'redirect(uri)'_ - sets a redirection response. Defaults to 302.
- _'send()'_ - finalizes the response and return control back to the router. Must be called after _'payload()'_ or _'stream()'_ to send the response.

For convenience, the 'response' object is also decorated with a shortcut function _'reply([result])'_ which is identical to calling _'reply.payload([result]).send()'_ or _'reply.stream(stream).send()'_.

The 'payload()', 'stream()', and 'redirect()' methods return a **hapi** Response object created based on the result item provided.
Depending on the response type, additional chainable methods are available:
- _'created(location)`_ - a URI value which sets the HTTP response code to 201 (Created) and adds the HTTP _Location_ header with the provided value (normalized to absolute URI). Not available with 'redirect()'.
- _'bytes(length)'_ - a pre-calculated Content-Length header value. Only available when using _'pipe(stream)'_.
- _'type(mimeType)'_ - a pre-determined Content-Type header value. Should only be used to override the built-in defaults.
- _'ttl(msec)'_ - a milliseconds value which overrides the default route cache expiration rule for this individual response.
- _'state(name, value, options)'_ - sets an HTTP state (cookie) as described in [Raw Cookies](#raw-cookies)
- _'unstate(name)'_ - instructs the client to remove the HTTP state.

The following methods are only available when using 'redirect()':
- _'message(text, type)'_ - a payload message and optional content type (defaults to 'text/html').
- _'uri(dest)'_ - the destination URI.
- _'temporary()_' - sets the status code to 302 or 307 (based on the rewritable settings). Defaults to 'true'.
- _'permanent()_' - sets the status code to 301 or 308 (based on the rewritable settings). Defaults to 'false'.
- _'rewritable(isRewritable)_' - sets the status code to 301/302 (based on the temporary settings) for rewritable (change POST to GET) or 307/308 for non-rewritable. Defaults to 'true'.

The handler must call _'reply()'_, _'reply.send()'_, or _'reply.payload/stream()...send()'_ (and only one, once) to return control over to the router. The reply methods are only available
within the route handler and are disabled as soon as control is returned.


#### Proxy

It is possible with hapi to setup a reverse proxy for routes.  This is especially useful if you plan to stand-up hapi in front of an existing API or you need to augment the functionality of an existing API.  Additionally, this feature is powerful in that it can be combined with caching to cache the responses from external APIs.  The proxy route configuration has the following options:
- `passThrough` - determines if the headers sent from the clients user-agent will be forwarded on to the external service being proxied to (default: false)
- `xforward` - determines if the x-forward headers will be set when making a request to the proxied endpoint (default: false)
- `host` - The host to proxy requests to.  The same path on the client request will be used as the path to the host.
- `port` - The port to use when making a request to the host.
- `protocol` - The protocol to use when making a request to the proxied host (http or https)
- `mapUri` - A function that receives the clients request and a passes the URI to a callback to make the proxied request to.  If host is set mapUri cannot be used, set either host or mapUri.
- `postResponse` - A function that will be executed before sending the response to the client for requests that can be cached.  Use this for any custom error handling of responses from the proxied endpoint.
- `httpClient` - A function that should make the request to the remote server and use execute the callback with a response.  By default this uses _'request'_ as the module.  The signature is (options, callback) where options will contain a url and method.

For example, to proxy a request to the homepage to google:
```javascript
// Create Hapi servers
var http = new Hapi.Server('0.0.0.0', 8080);

// Proxy request to / to google.com
http.addRoute({ method: 'GET', path: '/', handler: { proxy: { protocol: 'http', host: 'google.com', port: 80 } } });

http.start();
```


#### File

File handlers provide a simple way to serve a static file for a given route. This is done by specifying an object with the `file`
option as the route handler. The value of the `file` option is the absolute or relative path to the static resource. Relative paths
are resolved based on the server's `files` option as described in (Files)[#files]. The route path cannot contain parameters when
configured with a static file path. For example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080, { files: { relativeTo: 'process' } });

// Serve index.html file up a directory in the public folder
http.addRoute({ method: 'GET', path: '/', handler: { file: './public/index.html' } });

http.start();
```

The file handler also supports dynamic determination of the file being served based on the request, using a function as the value
of the `file` option with the signature _'function (request) { return './path'; }'_.  The function is passed the request object and
must return a string with the relative or absolute path to the static resource. For example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

// File mapping function
var filePath = function (request) {

    if (isMobileDevice(request)) {
        return './mobile/' + request.params.path;
    }

    return './public' + request.params.path;
};

http.addRoute({ method: 'GET', path: '/{path}', handler: { file: filePath } });

http.start();
```


#### Directory

Directory handlers provide a flexible way to serve static content from an entire directory tree. Similar to other web servers, **hapi**
allows mapping between a request path component to resources within a file system directory, including serving a default index.html or
a directory content listing.

Routes utilizing the directory handler must include a single path parameter at the end of the path string (e.g. _'/path/to/somewhere/{param}'_).
The directory handler is an object with the following options:
- `path` - a required path string or function. If the `path` is a string, it is used as the prefix for any resources requested within the route by appending the required route path parameter to the provided string. Alternatively, the `path` can be a function with the signature _'function (request) { return './path'; }'_.  The function is passed the request object and must return a string with the relative or absolute path to the static resource. Relative paths are resolved based on the server's `files` option as described in (Files)[#files].
- `index` - optional boolean, determines if 'index.html' will be served if exists in the folder when requesting a directory. Defaults to _'true'_.
- `listing` - optional boolean, determines if directory listing is generated when a directory is requested without an index document. Defaults to _'false'_.
- `showHidden` - optional boolean, determines if hidden files will be shown and served.  Defaults to _'false'_.

The required route path parameter can use any of the parameter options (e.g. '{param}', '{param?}', '{param*}'). For example, to server
only files in the top level folder and not to any subfolder use _'{path?}'_. If it is safe to navigate to child folders and files then
use _'{path*}'_. Similarly, if the server should only allow access to a certain level of subfolders then use _'{path*2}'_.

The following example shows how to serve a directory named _'public'_ and enable a directory listing in case a 'index.html' file doesn't exist:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

// Serve the public folder with listing enabled
http.addRoute({ method: 'GET', path: '/{path*}', handler: { directory: { path: './public/', listing: true } } });

http.start();
```

A function `path` can be used to serve different directory trees based on the incoming request. For example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

var directoryPath = function (request) {

    if (isMobileDevice(request)) {
        return './mobile';
    }

    return './public';
};

http.addRoute({ method: 'GET', path: '/{path*}', handler: { directory: { path: directoryPath } } });

http.start();
```


#### Views

Views provide a better way of generating HTML than string and variable concatenation. Similar to other web servers, 
**hapi** views allow handlers to efficiently generate HTML using templates by executing an individual template with a
pre-generated context object (which may contain dynamic content).

The following example shows how to render a basic handlebars/mustache template:

**index.js**
```javascript
    
    var http = new Hapi.Server('0.0.0.0', 8080, {
        views: {
            path: __dirname + '/templates'
        }
    });
        
    var handler = function (request) {

        request.reply.view('index', {
            title: 'Views Example'
            message: 'Hello, World'
        }).send();
    };

    http.addRoute({ method: 'GET', path: '/', handler: handler });
    http.start();
```

An example template:

**templates/index.html**
```html
<!DOCTYPE html>
<html>
    <head>
        <title>{{title}}</title>
    </head>
    <body>
        <div>
            <h1>{{message}}</h1>
        </div>
    </body>
</html>
```

On request, the user would be shown:

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Views Example</title>
    </head>
    <body>
        <div>
            <h1>Hello, World</h1>
        </div>
    </body>
</html>
```

More examples covering features such as layouts and partials can be found in the `examples/views` folder.


#### Options

To enable Views support, Hapi must be given an options object with a non-null `views` key. The views object
 supports the following options:

- `path` - (Required) the root file path where the request.reply.view function will resolve template names.
- `engine` - the configuration for what template rendering engine will be used (default: handlebars).
    - `module` - the npm module to require and use to compile templates (**this is experimental and may not not work with all modules**).
    - `extension` - the file extension used by template files.
- `partials` - this key enables partials support if non-null.
    - `path` - the root file path where partials are located (if different from views.path).
- `layout` - if set to true, layout support is enabled (default: false).
- `layoutKeyword` - the key used by the template engine to denote where primary template content should go.
- `encoding` - the text encoding used by the templates.
- `cache` - if set to false, templates will not be cached (thus will be read from file on every use).
- `allowAbsolutePaths` - the flag to set if absolute template paths passed to .view() should be allowed.
- `allowInsecureAccess` - the flag to set if `../` should be allowed in the template paths passed to `.view()`.

The above settings may also be overridden on a per view basis without affecting others:

    request.render.view(tmpl, ctx, { path: '/a/different/path' });


#### Views Handler

The route handler can be set to an object that points to a view file in order to make it easy to render a simple view.  The view context will have the payload, params, or querystring data that are available with the request.  For example, to render an _'about'_ page a route can be added as follows:

```javascript
    var http = new Hapi.Server('0.0.0.0', 8080, {
        views: {
            path: __dirname + '/templates'
        }
    });

    http.addRoute({ method: 'GET', path: '/{user}/about', handler: { view: 'about });
    http.start();
```

Then in the view there are properties for params, payload, and querystring.  Below is an example of rendering the _'user'_ that is passed in from the request path along with related values from the querystring.

```html
<!DOCTYPE html>
<html>
    <head>
        <title>About {{ params.user }}</title>
    </head>
    <body>
        <div>
            <h1>About {{ params.user }}</h1>
            <div>
                Age: {{ querystring.age }}
            </div>
            <div>
                Interests: {{ querystring.interests }}
            </div>
        </div>
    </body>
</html>
```

#### Layouts

The View system supports Layouts. Layouts are a single template file which is used as a parent template for individual view templates - the view template is directly embedded in a layout. This allows developers to give the website(s) a consistent appearance while also keeping HTML code as well as minimizing repeated code (the boilerplate with stylesheet includes, javascript includes, html displayed on every page).

To use, set the Hapi view option `layout` to true and create a file `layout.html` in your `views.path`.

**layout.js**
```javascript

    var options = {
        views: {
            path: __dirname + '/templates',
            engine: {
                module: 'handlebars',
                extension: 'html'
            },
            layout: true
        }
    };
    
    var handler = function (request) {

        request.reply.view('withLayout/index', {
            title: 'examples/views/layout.js | Hapi ' + Hapi.utils.version(),
            message: 'Hello World!\n'
        }).send();
    };

    var server = new Hapi.Server(8080, options);
    server.addRoute({ method: 'GET', path: '/', handler: handler });
    server.start();
```

**templates/layout.html**
```html
<!DOCTYPE html>
<html>
    <head>
        <title>{{title}}</title>
    </head>
    <body>
        <p>Layout header</p>
        {{{ content }}}
        <p>Layout footer</p>
    </body>
</html>
```

**templates/withLayout/index.html**
```html
<div>
    <h1>{{message}}</h1>
</div>
```

**returned to user**:
```html
<!DOCTYPE html>
<html>
    <head>
        <title>examples/views/layout.js | Hapi 0.11.0</title>
    </head>
    <body>
        <p>Layout header</p>
        <div>
            <h1>Hello World!\n</h1>
        </div>
        <p>Layout footer</p>
    </body>
</html>
```

The `layout.html` must be located in the path or an error will be returned. Notice that the content from view template `withLayout/index` is executed with the context provided in the handler then embedded into the layout in place of `{{{ content }}}`. To change the keyword for embedding the view template, set the `layoutKeyword` option.


#### Partials

The View system also supports Partials. Partials are small segments of template code that can be nested and reused throughout other templates.

**partials.js**
```javascript

    var options = {
        views: {
            path: __dirname + '/templates',
            engine: {
                module: 'handlebars'
            },
            partials: {
                path: __dirname + '/templates/withPartials'
            }
        }
    };
    
    var handler = function (request) {

        request.reply.view('withPartials/index', {
            title: 'examples/views/partials.js | Hapi ' + Hapi.utils.version(),
            message: 'Hello World!\n'
        }).send();
    };

    var server = new Hapi.Server(3000, options);
    server.addRoute({ method: 'GET', path: '/', handler: handler });
    server.start();
```

**withPartials/index.html**
```html
<!DOCTYPE html>
<html>
    <head>
        <title>{{title}}</title>
    </head>
    <body>
        {{> header}}
        <div>
            <h1>{{message}}</h1>
        </div>
        {{> footer}}
    </body>
</html>
```

**withPartials/header.html**
```html
<div>
    <h3>Views with Partials</h3>
</div>
```

**withPartials/footer.html**
```html
<footer>
    <p>hapi.js 2013</p>
</footer>
```

**returned to user**
```html
<!DOCTYPE html>
<html>
    <head>
        <title>examples/views/partials.js | Hapi 0.11.0</title>
    </head>
    <body>
        <div>
            <h3>Views with Partials</h3>
        </div>
        <div>
            <h1>Hello World!\n</h1>
        </div>
        <footer>
            <p>hapi.js 2013</p>
        </footer>
    </body>
</html>
```

The above example will use `views.partials.path` as the partials directory. Hapi will recursively find template files and automatically add them to the partial registry for use in view templates. 

Deeply nested partials are also supported.  A view template can reference a partial stored in `viewsPath/nav/nav.html` like so:

```html
    <body>
        {{> nav/nav}}
        <div id="container">
    ...
```



### Documentation

**This is an experimental feature and is likely to change!**

In order to make it easy to generate documentation for the routes you add to **hapi**, a documentation generator is provided. By default the documentation
generator is turned _off_. To enable the docs endpoint add a new route with a handler object that has a docs property set to true or to an object with the following options:
- `indexTemplatePath` - the file path where the index template file is located.  Default is 'lib/templates/index.html' inside the lout module.
- `indexTemplate` - the raw source of a index template to use.  If `indexTemplate` is provided then it will be used over the file located at `indexTemplatePath`.
- `routeTemplatePath` - the file path where the routes template file is located.  Default is 'lib/templates/route.html' inside the lout module.
- `routeTemplate` - the raw source of a route template to use.  If `routeTemplate` is provided then it will be used over the file located at `routeTemplatePath`.
- `templateParams` - an optional object of any extra information you want to pass into your template, this will be located in the templateParams object in the template data object.

By default there is an index page that lists all of the available routes configured in **hapi** that is located at the `docsEndpoint`.  From this page users are able to navigate to individual routes to read the related documentation.

The simplest example of enabling docs on a site is shown in the following example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

http.addRoute({ method: 'GET', path: '/docs', handler: { docs: true } });

http.start();
```


#### Request Logging

In addition to the [General Events Logging](#general-events-logging) mechanism provided to log non-request-specific events, **hapi** provides
a logging interface for individual requests. By associating log events with the request responsible for them, it is easier to debug and understand
the server's behavior. It also enables batching all the request log events and deliver them to the monitor as a single package.

The request object is also decorated with the following methods.
- _'log(tags, [data, timestamp])'_ which adds a record to the request log where:
    - _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the logged event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.
    - _'data'_ - an optional message string or object with the application data being logged.
    - _'timestamp'_ - an optional timestamp override (if not present, the server will use current time), expressed in milliseconds since 1970 (_new Date().getTime()_).
- _'getLog(tags)'_ - Returns an array of events which match the tag(s) specifed.

For example:
```javascript
var Hapi = require('hapi');

// Create Hapi servers
var http = new Hapi.Server('0.0.0.0', 8080);

// Route handler
var testLogs = function (request) {

    request.log('error', new Error('Something failed'));
    
    if (request.getLog('error').length === 0) {
        request.reply('Success!');
    }
    else {
        request.reply('Failure!');
    }
};

// Set routes
http.addRoute({ method: 'GET', path: '/', handler: testLogs });

// Start Hapi servers
http.start();
```

The 'request.log' method is always available.


### Query Validation

When a request URI includes a query component (the key-value part of the URI between _?_ and _#_), the query is parsed into its individual
key-value pairs (see [Query String](http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)) and stored in
'request.query'.

The route `config.validate.query` defines the query validation rules performed before the route handler is invoked. Supported values:
- _'true'_ or _'{}'_ - any query parameters allowed (no validation performed).  This is the default.
- _'false'_ - no query parameters allowed.
- a validation rules object as described in [Data Validation](#data-validation).


### Payload Validation

The route `config.validate.schema` defines the payload validation rules performed before the route handler is invoked. Supported values:
- _'true'_ or _'{}'_ - any payload allowed (no validation performed). This is the default.
- _'false'_ - no payload allowed.
- a validation rules object as described in [Data Validation](#data-validation).


### Path Validation

When a request comes in for a route that allows for path parameters the request is path parameters are parsed into request.params.

The route `config.validate.path` defines the path validation rules performed before the route handler is invoked. Supported values:
- _'true'_ or _'{}'_ - any path parameters allowed (no validation performed).  This is the default.
- _'false'_ - no path variables allowed.
- a validation rules object as described in [Data Validation](#data-validation).


### Response Validation

The route `config.response` defines the payload validation rules performed after the route handler is invoked. Supported values:
- _'null'_ - any payload allowed (no validation performed). This is the default.
- _'false'_ or _'{}'_ - no payload allowed.
- an object with the following options
    - _'schema'_ - a validation rules object as described in [Data Validation](#data-validation).
    - _'sample'_ - the percentage of responses to validate.  By default 100% of responses will be validated, to turn this off set the value to 0.  To validate half of the responses set this value to 50.
    - _'failAction'_ - _'error'_ (return 500), _'log'_ (report error but send reply as-is), or _'ignore'_ (send reply as-is) when a response is invalid. Defaults to _'error'_.

Response validation can only be performed on object responses and will otherwise result in an error.


### Caching

'GET' routes may be configured to use the built-in cache if enabled using the server `cache` option. The route cache config has the following options:
- `mode` - determines if the route is cached on the server, client, or both. Defaults to _'server+client'_.
    - `server+client` - Caches the route response on the server and client (default)
    - `client` - Sends the Cache-Control HTTP header on the response to support client caching
    - `server` - Caches the route on the server only
    - `none` - Disable cache for the route on both the client and server
- `segment` - Optional segment name, used to isolate cached items within the cache partition. Defaults to '#name' for server helpers and the path fingerprint (the route path with parameters represented by a '?' character) for routes. Note that when using the MongoDB cache strategy, some paths will require manual override as their name will conflict with MongoDB collection naming rules.
- `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with `expiresAt`.
- `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route expire. Cannot be used together with `expiresIn`.
- `strict` - determines if only _'Cacheable'_ responses are allowed.  If a response that is not _'Cacheable'_ is returned and strict mode is enabled then an error will be thrown.  Defaults to '_false_'.

For example, to configure a route to be cached on the client and to expire after 2 minutes the configuration would look like the following:
```
{
    mode: 'client',
    expiresIn: 120000
}
```

The server-side cache also supports these advanced options:
- `staleIn` - number of milliseconds from the time the item was saved in the cache after which it is considered stale. Value must be less than 86400000 milliseconds (one day) if using `expiresAt` or less than the value of `expiresIn`. Used together with `staleTimeout`.
- `staleTimeout` - if a cached response is stale (but not expired), the route will call the handler to generate a new response and will wait this number of milliseconds before giving up and using the stale response. When the handler finally completes, the cache is updated with the more recent update. Value must be less than `expiresIn` if used (after adjustment for units).


### Prequisites

Before the handler is called, it is often necessary to perform other actions such as loading required reference data from a database. The `pre` option
allows defining such pre-handler methods. The methods are called in order, unless a `mode` is specified with value 'parallel' in which case, all the parallel methods
are executed first, then the rest in order. The `pre` is a mixed array of functions and objects. If a function is included, it is the same as including an
object with a single `method` key. The object options are:
- `method` - the function to call. The function signature is _'function (request, next)'_. _'next([result])'_ must be called when the operation concludes. If the result is an Error, execution of other prerequisites stops and the error is handled in the same way as when an error is returned from the route handler.
- `assign` - key name to assign the result of the function to within 'request.pre'.
- `mode` - set the calling order of the function to 'serial' or 'parallel'. Defaults to 'serial'.

For example:
```javascript
// Create Hapi servers
var http = new Hapi.Server('0.0.0.0', 8080);

var fetch1 = function (request, next) {

    next('Hello');
};

var fetch2 = function (request, next) {

    next('World');
};

var fetch3 = function (request, next) {

    next(request.pre.m1 + ' ' + request.pre.m2);
};

var get = function (request) {

    request.reply(request.pre.m3 + '\n');
};

// Set routes
http.addRoute({
    method: 'GET',
    path: '/',
    config: {
        pre: [
            { method: fetch1, assign: 'm1', mode: 'parallel' },
            { method: fetch2, assign: 'm2', mode: 'parallel' },
            { method: fetch3, assign: 'm3' },
        ],
        handler: get
    }
});

// Start Hapi servers
http.start();
```


## Data Validation

**hapi** supports a rich set of data types and validation rules which are described in detail in the [**joi** module documentation](/walmartlabs/joi).
For example:

```javascript
var Hapi = require('hapi');

var S = Hapi.Types.String;
var I = Hapi.Types.Int;

var rules = {
    username: S().required().alphanum().min(3).max(30).with('email'),
    password: S().regex(/[a-zA-Z0-9]{3,30}/).without('token'),
    token: S(),
    birthyear: I().min(1850).max(2012),
    email: S().email(),
    type: S().valid('admin', 'limited', 'normal')
};
```

In which:
- 'username' is a required alphanumeric string, 3 to 30 characters long, and must appear together with 'email'.
- 'password' is an optional string matching a regular expression, and must not appear together with 'token'.
- 'token' is an optional string.
- 'birthyear' is an optional integer between 1980 and 2012.
- 'email' is an optional string with valid email address.
- 'type' is an optional string which must be set to one of three available values.


## Response Errors

The 'Hapi.Error' module provides helper methods to generate error responses:
- _'badRequest([message])'_ - HTTP 400 (Bad Request).
- _'unauthorized([message])'_ - HTTP 401 (Unauthorized).
- _'forbidden([message])'_ - HTTP 403 (Not Allowed).
- _'notFound([message])'_ - HTTP 404 (Not Found).
- _'internal([message, data])'_ - HTTP 500 (Internal Error). The optional _message_ and _data_ values are not returned to the client but are logged internally.

The _message_ value is optional and will be returned to the client in the response unless noted otherwise. For example:

```javascript
function onUnknownRoute(request) {

    request.reply(Hapi.Error.unknown('Sorry, nobody home'));
}
```

Error responses are send as JSON payload with the following keys (unless an [error response override](#errors) is configured):
- _code_ - the HTTP status code (e.g. 400).
- _error_ - the HTTP status message (e.g. 'Bad Request').
- _message_ - the returned message if provided.

The complete error repsonse including any additional data is added to the request log.


## State Management

### Raw Cookies

Cookies can be set directly via the response _'state(name, value, options)'_ interface where:
- 'name' - is the cookie name,
- 'value' - is the cookie value, and
- 'options' - is an optional structure with the following optional keys:
    - `ttl' - time-to-live in milliseconds.
    - `isSecure` - sets the 'Secure' flag.
    - `isHttpOnly` - sets the 'HttpOnly' flag.
    - `path` - the path scope.
    - `domain` - the domain scope.
    - `encoding` - encoding performs on the provided value before serialization. Options are:
        - 'none' - no encoding. This is the default value. Value must be a string.
        - 'base64' - string value is encoded using Base64.
        - 'base64json' - object value is JSON-stringified than encoded using Base64.
        - 'form' - object value is encoded using the _x-www-form-urlencoded_ method.

Cookie definitions can be registered with the server using the server's _'addState(name, options)'_ method, where 'options' is the same as above.
If a cookie definition is found, the options are used for that cookie as defaults before other options specified at the time of state() invocation
are applied. In addition, the `encoding` option is used when receiving a cookie from the client to parse the cookie's value.


## General Events Logging

Most of the server's events usually relate to a specific incoming request. However, there are sometimes event that do not have a specific request
context. **hapi** provides a logging mechanism for general events using a singleton logger 'Hapi.Log' module. The logger provides the following methods:
- _'event(tags, [data, timestamp])'_ - generates an event where:
    - _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.
    - _'data'_ - an optional message string or object with the application data being logged.
    - _'timestamp'_ - an optional timestamp override (if not present, the server will use current time), expressed in milliseconds since 1970 (_new Date().getTime()_).
- _'print(event)'_ - outputs the given _'event'_ to the console.

The logger is an event emitter. When an event is generated, the logger's _'log'_ event is emitted with the event object as value.
If no listeners are registered, the event is printed to the console.

For example:
```javascript
var Hapi = require('hapi');

// Listen to log events
Hapi.Log.on('log', function (event) {

    // Send to console
    Hapi.Log.print(event);
});

// Generate event
Hapi.Log.event(['test','info'], 'Test event');

```


## Request Tails

It is often desirable to return a response as quickly as possible and perform additional (slower) actions afterwards (or in parallel). These
actions are called request tails. For example, a request may trigger a database update tail that should not delay letting the client know the
request has been received and will be processed shortly. However, it is still desirable to associate the tails with the request and to know
when every single request related action has completed (in other words, when the request stopped wagging).

**hapi** provides a simple facility for keeping track of pending tails by providing the following request methods:
- _'addTail([name])'_ - registers a named tail and returns a tail function. The tail function must be retained and used to remove the tail when completed. The method is available on every event or extension hook prior to the 'tail' event.
- _'removeTail(tail)'_ - removes a tail to notify the server that the associated action has been completed.

Alternatively, the returned tail function can be called directly without using the _removeTail()_ method.

For example:
```javascript
var Hapi = require('hapi');

// Create Hapi servers
var http = new Hapi.Server('0.0.0.0', 8080);

// Route handler
var get = function (request) {

    var tail1 = request.addTail('tail1');
    setTimeout(function () {

        request.removeTail(tail1);              // Using removeTail() interface
    }, 5000);

    var tail2 = request.addTail('tail2');
    setTimeout(function () {

        tail2();                                // Using tail function interface
    }, 2000);

    request.reply('Success!');
};

// Set routes
http.addRoute({ method: 'GET', path: '/', handler: get });

// Listen to tail events
http.on('tail', function (request) {

    console.log('Wag the dog');
});

// Start Hapi servers
http.start();
```


## Request Injection

Request injection is the process of simulating an HTTP request without making an actual socket request. Injection is useful for testing
or debugging purposes, but also for invoking routing logic internally without the overhead or limitations of the network stack. For example,
implementing a batch mechanism which calls multiple internal routes.

**hapi** uses the [**shot**](https://github.com/hueniverse/shot) module for performing injections. To inject a request, use the server's
_'inject(options, callback)'_ method in which:
- _'options'_ - is an object containing the request information. Available options:
    - `method` - the request HTTP method. Required.
    - `url` - the request URL (as it would appear in an incoming node request object). Required.
    - `headers` - any request headers. Optional.
    - `payload` - a string or Buffer containing the request payload. Optional.
    - `session` - a session object containing authentication information as described in [Route Handler](#route-handler). The `session` option is used to bypass the default authentication validation and use a pre-authenticated session. Optional.
- _'callback'_ - a callback function with the signature _'function (res)'_ where 'res' is the injection response object. The response object properties include:
    - _'headers'_ - an array containing the headers set.
    - _'statusCode'_ - the HTTP status code.
    - _'readPayload()'_ - the payload converted to a string.
    - _'result'_ - if present, the original route handler reply object.
    - _'raw'_ - the injection request and response objects.

**This is an experimental feature and is likely to change!**

For example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

// Handler
var get = function (request) {

    request.reply('Success!');
};

// Set routes
http.addRoute({ method: 'GET', path: '/', handler: get });

// Injection options
var req = {
    method: 'get',
    url: '/'
};

http.inject(req, function (res) {

    console.log(res.result || res.readPayload());
});
```


## Server Helpers

Server helpers are functions registered with the server and can be used throughout the application. The advantage of using helpers is
that they can be configured to use the built-in cache and shared across multiple request handlers. This provides a useful method for
speeding up performance by declaring functions as common utilities with a shared cache.

The signature of helper functions is _'function (arg1, arg2, ..., arg3, next)'_ where next is a function defined as _'function (result)'_.
'result' can be any value or an Error (which must be generated using the **hapi** Error module is the helper is used as a prerequisite method).

To add a helper, use the server's _'addHelper(name, method, options)'_ method where:
- _'name'_ - is a unique helper name used to call the method (e.g. 'server.helpers.name').
- _'method'_ - is the helper function.
- _'options'_ - optional settings where:
    - `cache` - cache configuration as described in [Caching](#caching). `mode` can use the default or be set to 'server'.
    - `keyGenerator` - the server will automatically generate a unique key if the function's arguments (with the exception of the last 'next' argument) are all of type string, number, or boolean. However if the function uses other types of arguments, a key generation function must be provided which takes the same arguments as the function and returns a unique string (or null if no key can be generated). Note that when the keyGenerator method is invoked, the arguments list will include the next argument which must not be used in calculation of the key.

For example:
```javascript
// Create Hapi server
var server = new Hapi.Server('0.0.0.0', 8080);

var user = function (id, next) {

    next({ id: id });
};

var options = {
    cache: {
        expiresIn: 2000,
        staleIn: 1000,
        staleTimeout: 100
    },
    keyGenerator: function (id) {

        return id;
    };
};

server.addHelper('user', user, options);

server.helpers.user(4, function (result) {

    console.log(result);
});
```

Or used as a prerequisites:
```javascript
http.addRoute({
    method: 'GET',
    path: '/user/{id}',
    config: {
        pre: [
            {
                assign: 'user',
                method: function (request, next) {

                    request.server.helpers.user(request.params.id, next);
                }
            }
        ],
        handler: function (request) {

            request.reply(request.pre.user);
        }
    }
});
```


# The End

hapi hapi, joi joi
