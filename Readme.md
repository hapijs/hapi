<img src="https://raw.github.com/walmartlabs/hapi/master/images/hapi.png" />

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

# Table of Content

- [**Usage**](#usage)
	- [**Basic Usage**](#basic-usage)
	- [**Server Configuration**](#server-configuration)
		- [TLS](#tls)
		- [Router](#router)
		- [Payload](#payload)
		- [Extensions](#extensions)
			- [Unknown Route](#unknown-route)
		- [Errors](#errors)
			- [Error Response Override](#error-response-override)
		- [Monitor](#monitor)
		- [Authentication](#authentication)
		- [Cache](#cache)
		- [Debug](#debug)
		- [CORS](#cors)
	- [**Route Configuration**](#route-configuration)
		- [Configuration options](#configuration-options)
		- [Override Route Defaults](#override-route-defaults)
		- [Path Processing](#path-processing)
			- [Parameters](#parameters)
		- [Route Handler](#route-handler)
			- [Logging](#logging)
		- [Query Validation](#query-validation)
		- [Payload Validation](#payload-validation)
  - [**Data Validation**](#data-validation)
    
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
    method: 'GET',
    path: '/hello',
    config: hello
});

// Start the server
server.start();
```

Now navigate to http://localhost:8080/hello and you should receive 'hello world'.

## Server Configuration

**hapi** provides a rich set of configuration options for each server instance:

- [`tls`](#tls)
- [`router`](#router)
- [`payload`](#payload)
- [`ext`](#extensions)
- [`errors`](#Errors)
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

The `router` option controls how incoming request URIs are matched against the routing table. The router only uses the first match found. Router options:
- `isTrailingSlashSensitive` - determines whether the paths '/example' and '/example/' are considered different resources. Defaults to _false_.
- `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to _true_.

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
- `onPostHandler` - called after the request handler, before sending the response.
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
When the extension handler is called, the _'request'_ object is decorated with two methods:
- _'reply(result)'_ - returns control over to the server with a custom response value which can be a string or object.
- _'close()'_ - returns control over to the server after the application has taken care of responding to the request via the _request.raw.res_ object directly.
The method **must** call _'reply(result)'_ or _'close()'_ but not both.

For example, using the _'close()'_ method:
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
    request.close();
}
```

Or using the _'reply(result)'_ method:
```javascript
function onUnknownRoute(request) {

    request.reply({ roads: 'ocean' });
}
```

### Errors

The 'Hapi.Error' module provides helper methods to generate error responses:
- _'badRequest(message)'_ - HTTP 400 (Bad request).
- _'unauthorized(message)'_ - HTTP 401 (Unauthorized).
- _'forbidden(message)'_ - HTTP 403 (Not allowed).
- _'notFound(message)'_ - HTTP 404 (Not found).
- _'internal(message, data)'_ - HTTP 500 (Internal error). The optional _message_ and _data_ values are not returned to the client but are logged internally.
- _'create(message, code, text, options) - creates a custom error with the provided _message_, _code_ (the HTTP status code), _text_ (the HTTP status message), and any keys present in _options_.

The _message_ value is optional and will be returned to the client in the response unless noted otherwise. For example:

```javascript
function onUnknownRoute(request) {

    request.reply(Hapi.Error.unknown('Sorry, nobody home'));
}
```

Error responses are send as JSON payload with the following keys:
- _code_ - the HTTP status code (e.g. 400).
- _error_ - the HTTP status message (e.g. 'Bad request').
- _message_ - the returned message if provided.

The complete error repsonse including any additional data is added to the request log.

#### Error Response Override

If a different error format than the default JSON response is required, the server `errors.format` option can be assigned a function to generate a
different error response. The function signature is _'function (result, callback)'_ where:
- _'result'_ - is the **hapi** error object returned by the route handler, and
- _'callback'_ - is the callback function called with the new result object or string.

For example:
```javascript
var options = {
    errors: {
        format: function (result, callback) {
        
            callback('Oops: ' + result.message);
        }
    }
};
```

### Monitor

**hapi** comes with a built-in process monitor for three types of events:
- System and process performance (ops) - CPU, memory, disk, and other metrics.
- Requests logging (request) - framework and application generated logs generated during the lifecycle of each incoming request.
- General events (log) - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc.

The monitor is _off_ by default and can be turned on using the `monitor` server option. To use the default settings, simply set the value to _true_.
Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination as general events (log)
are a process-wide facility and will result in duplicated log events. To override some or all of the defaults, set `monitor` to an object with the following
optional settings:
- `broadcastInterval` - the interval in milliseconds to send collected events to subscribers. _0_ means send immediately. Defaults to _0_.
- `opsInterval` - the interval in miliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `extendedRequests` - determines if the full request log is sent or only the event summary. Defaults to _false_.
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

#### General Events Logging

Most of the server's events usually relate to a specific incoming request. However, there are sometimes event that do not have a specific request
context. **hapi** provides a logging mechanism for general events using a singleton logger 'Hapi.Log' module. The logger provides the following methods:
- _'event(tags, data, timestamp)'_ - generates an event where:
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

### Authentication

The authentication interface is disabled by default and is still experimental.

### Cache

**hapi** provides a built-in caching facility for storing and reusing request responses. The initial implementation uses Redis for its storage needs
(must be manually installed and configured). The cache functionality is _off_ by default. To enable caching, the `cache` option must be set to _true_ or
to an object with custom configuration:
- `engine` - currently must be set to _redis_.
- `host` - the Redis server hostname, defaults to _127.0.0.1_.
- `port` - the Redis server port, defaults to _6379_.

Enabling the server cache only creates the cache interface but does not enable caching for any route, which must be enabled and configured in the
route configuration.

### Debug

To assist in debugging server events related to specific incoming requests, **hapi** includes an optional debug console which is turned _off_ by default.
The debug console is a simple web page in which developers can subscribe to a debug id, and then include that debug id as an extra query parameter in each
request. The server will use WebSocket to stream the subscribed request logs to the web page in real-time. In application using multiple server instances,
only one can enable the debug interface using the default port. To enable the debug console, set the `debug` option to _true_ or to an object with custom
configuration:
- `websocketPort` - the port used by the WebSocket connection. Defaults to _3000_.
- `debugEndpoint` - the debug console request path added to the server routes. Defaults to _'/debug/console'_.
- `queryKey` - the name or the request query parameter used to mark requests being debugged. Defaults to _debug_.

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

**hapi** was designed to move as much logic as possible from the route handler to the route configuration. The goal is to provide a simple
mechanism for defining routes without having to write code. This approach also enables producing dynamic route documentation without having
to write additional text as the configuration itself serves as a living documentation.

### Configuration options

* `path` - the absolute path or regular expression to match against incoming requests. Path comparison is configured using the server [`router`](#router) option. String paths can include named identifiers prefixed with _':'_ as described in [Path Parameters](#path-processing).
* `method` - the HTTP method. Typically one of _'GET, POST, PUT, DELETE, OPTIONS'_. Any HTTP method is allowed, except for _'HEAD'_. **hapi** does not provide a way to add a route to all methods.
* `handler` - the business logic function called after authentication and validation to generate the response. The function signature is _function (request)_ where _'request'_ is the **hapi** request object. See [Route Handler](#route-hander) for more information.
* `config` - route configuration grouped into a sub-object to allow splitting the routing table from the implementation details of each route. Options include:
  * `description` - route description.
  * `notes` - route notes (string or array of strings).
  * `tags` - route tags (array of strings).
  * `query` - validation rules for incoming requests' query component (the key-value part of the URI between _?_ and _#_). Defaults to no query parameters allowed. See [Query Validation](#query-validation) for more information.
  * `schema` - validation rules for incoming requests' payload (request body). Defaults to no validation (any payload allowed). Set to an empty object _'{}'_ to forbid payloads. See [Payload Validation](#payload-validation) for more information.
  * `payload` - determines how the request payload is processed. Defaults to _'parse'_ if `schema` is present or `method` is _'POST'_ or _'PUT'_, otherwise _'stream'_. Payload processing is configured using the server [`payload`](#payload) option. Options are:
    * _'stream'_ - the incoming request stream is left untouched, leaving it up to the handler to process the request via _'request.raw.req'_.
    * _'raw'_ - the payload is read and stored in _'request.rawBody'_ but not parsed.
    * _'parse'_ - the payload is read and stored in _'request.rawBody'_ and then parsed (JSON or form-encoded) and stored in _'request.payload'_.
  * `auth` - authentication configuration
    * `mode` - the authentication mode. Defaults to _'required'_ is the `authentication` server option is set, otherwise _'none'_. Available options include:
      * _'none'_ - authentication not allowed.
      * _'required'_ - authentication is required.
      * _'optional'_ - authentication is optional (validated if present).
    * `tos` - minimum terms-of-service version required. This is compared to the terms-of-service version accepted by the user. Defaults to _none_.
    * `scope` - required client scope. Defaults to _none_.
    * `entity` - the required authenticated entity type. Available options include:
      * _'any'_ - the authentication can be on behalf of a user or client.
      * _'user'_ - the authentication must be on behalf of a user.
      * _'client'_ - the authentication must be on behalf of a client.

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
* Static - the route path is a static string which begin with _'/'_ and will only match incoming requests containing the exact string match (as defined by the server `router` option).
* Parameterized - same as _static_ with the additional support of named parameters (prefixed with _':'_).
* Regular expression - the route path will be matched against the provided regular expression. No parameter extraction performed.

#### Parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming request path at that level. For example, the route:
'/book/:id/cover' will match: '/book/123/cover' and 'request.params.id' will be set to '123'. Each path level (everything between the opening _'/'_ and
 the closing _'/'_ unless it is the end of the path) can only include one named parameter. The _'?'_ suffix can at the end of the parameter name indicates
an optional parameter. For example: the route: '/book/:id?' will match: '/book/' (and may match '/book' based on the server `router` option).

```javascript
server.addRoute({
    path: '/:album/:song?',
    method: 'GET',
    handler: getAlbum
});

function getAlbum(request) {

    request.reply('You asked for ' + (request.params.song ? request.params.song + ' from ' : '') + request.params.album);
}
```

### Route Handler

When the provided route handler method is called, it receives a _request_ object with the following properties:
- _'url'_ - the parsed request URI.
- _'path'_ - the request URI's path component.
- _'query'_ - an object containing the query parameters.
- _'params'_ - an object containing the path named parameters as described in [Path Parameters](#parameters).
- _'rawBody'_ - the raw request payload (except for requests with `config.payload` set to _'stream'_).
- _'payload'_ - an object containing the parsed request payload (for requests with `config.payload` set to _'parse'_).
- _'session'_ - available for authenticated requests and includes:
    - _'used'_ - user id.
    - _'client'_ - client id.
    - _'tos'_ - terms-of-service version.
    - _'scope'_ - approved client scopes.
- _'server'_ - a reference to the server object.
- _'raw'_ - an object containing the Node HTTP server 'req' and 'req' objects. Direct interaction with the raw objects is not recommended.
- _'response'_ - contains the route handler's response after the handler is called. Direct interaction with the raw objects is not recommended.

The request object is also decorated with a few helper functions:
- _'reply(result)'_ - once the response is ready, the handler must call the _'reply(result)'_ method with the desired response.
- _'created(uri)'_ - sets the HTTP response code to 201 (Created) and adds the HTTP _Location_ header with the provided value (normalized to absolute URI). Must be called before the required _'reply(result)'_.

When calling _'reply(result)'_, the _result_ value can be set to a string which will be treated as an HTML payload, or an object which will be
returned as a JSON payload. The default HTTP status code returned is 200 (OK). If the return is an object and is an instance of Error, an HTTP
error response (4xx, 5xx) will be returned. Errors must be generated using the 'Hapi.Error' module described in [Errors](#errors).

The helper methods are only available within the route handler and are disabled as soon as _'reply(result)'_ is called. 

#### Request Logging

In addition to the [General Events Logging](#general-events-logging) mechanism provided to log non-request-specific events, **hapi** provides
a logging interface for individual requests. By associating log events with the request responsible for them, it is easier to debug and understand
the server's behaviour. It also enables batching all the request log events and deliver them to the monitor as a single package.

The request object is also decorated with the _'log(tags, data, timestamp)'_ which adds a record to the request log where:
- _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the logged event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.
- _'data'_ - an optional message string or object with the application data being logged.
- _'timestamp'_ - an optional timestamp override (if not present, the server will use current time), expressed in milliseconds since 1970 (_new Date().getTime()_).

The 'request.log' method is always available.

### Query Validation

When a request URI includes a query component (the key-value part of the URI between _?_ and _#_), the query is parsed into its individual
key-value pairs (see [Query String](http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)) and stored in
'request.query'. 

### Payload Validation


## Data Validation




