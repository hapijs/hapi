![hapi Logo](https://raw.github.com/walmartlabs/hapi/master/images/hapi.png)

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

Current version: **0.7.0**

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

# Table of Content

- [**Usage**](#usage)
	- [**Basic Usage**](#basic-usage)
<p></p>
	- [**Server Configuration**](#server-configuration)
		- [TLS](#tls)
		- [Router](#router)
		- [Payload](#payload)
		- [Extensions](#extensions)
			- [Unknown Route](#unknown-route)
		- [Errors](#errors)
		- [Monitor](#monitor)
		- [Authentication](#authentication)
		- [Cache](#cache)
		- [Debug](#debug)
		- [Documentation] (#documentation)
		- [CORS](#cors)
		- [Batch](#batch)
<p></p>
    - [**Server Events**](#server-events)
<p></p>
	- [**Route Configuration**](#route-configuration)
		- [Configuration options](#configuration-options)
		- [Override Route Defaults](#override-route-defaults)
		- [Path Processing](#path-processing)
			- [Parameters](#parameters)
		- [Route Handler](#route-handler)
			- [Request Logging](#request-logging)
		- [Query Validation](#query-validation)
		- [Payload Validation](#payload-validation)
        - [Caching](#caching)
<p></p>
	- [**Data Validation**](#data-validation)
<p></p>
	- [**Response Errors**](#response-errors)
<p></p>
    - [**General Events Logging**](#general-events-logging)
<p></p>
	- [**Request Tails**](#request-tails)
<p></p>
	- [**Request Injection**](#request-injection)
  
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
- _'reply([result])'_ - returns control over to the server with a custom response value which can be a string or object.
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
only one can enable the debug interface using the default port. To enable the debug console set the `debug` option to _true_ or to an object with custom
configuration:
- `websocketPort` - the port used by the WebSocket connection. Defaults to _3000_.
- `debugEndpoint` - the debug console request path added to the server routes. Defaults to _'/debug/console'_.
- `queryKey` - the name or the request query parameter used to mark requests being debugged. Defaults to _debug_.

### Documentation

**This is an experimental feature and is likely to change!**

In order to make it easy to generate documentation for the routes you add to **hapi**, a documentation generator is provided. By default the documentation
generator is turned _off_. To enable the docs endpoint set the `docs` option to _true_ or to an object with custom configuration:
- `docsEndpoint` - the path where the documentation will be served from. Default is '/docs'.
- `indexTemplatePath` - the file path where the index template file is located.  Default is 'lib/templates/index.html'.
- `indexTemplate` - the raw source of a index template to use.  If `indexTemplate` is provided then it will be used over the file located at `indexTemplatePath`.
- `routeTemplatePath` - the file path where the routes template file is located.  Default is 'lib/templates/route.html'.
- `routeTemplate` - the raw source of a route template to use.  If `routeTemplate` is provided then it will be used over the file located at `routeTemplatePath`.
- `templateParams` - an optional object of any extra information you want to pass into your template, this will be located in the templateParams object in the template data object.

By default there is an index page that lists all of the available routes configured in **hapi** that is located at the `docsEndpoint`.  From this page users are able to navigate to individual routes to read the related documentation.

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

As an example to help explain the use of the endpoint, assume that the server has a route at '/currentuser' and '/users/:id/profile/'.  You can make a POST request to the batch endpoint with the following body:
`{ "GET": [ "/currentuser", "/users/$0.id/profile ] }` and it will return an array with the current user and their profile.

## Server Events

The server object emits the following events:
- _'response'_ - emitted after a response is sent back. Includes the request object as value.
- _'tail'_ - emitted when a request finished processing, including any registered tails as described in [Request Tails](#request-tails).

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
  * `cache` - if the server `cache` option is enabled and the route method is 'GET', the route can be configured to use the cache as described in [Caching](#caching).
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

    request.reply('You asked for ' +
                  (request.params.song ? request.params.song + ' from ' : '') +
                  request.params.album);
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
- _'reply([result])'_ - once the response is ready, the handler must call the _'reply(result)'_ method with the desired response.
- _'created(uri)'_ - sets the HTTP response code to 201 (Created) and adds the HTTP _Location_ header with the provided value (normalized to absolute URI). Must be called before the required _'reply(result)'_.
- _'addTail([name])'_ - adds a request tail as described in [Request Tails](#request-tails).

When calling _'reply(result)'_, the _result_ value can be set to a string which will be treated as an HTML payload, or an object which will be
returned as a JSON payload. The default HTTP status code returned is 200 (OK). If the return is an object and is an instance of Error, an HTTP
error response (4xx, 5xx) will be returned. Errors must be generated using the 'Hapi.Error' module described in [Errors](#errors).

The helper methods are only available within the route handler and are disabled as soon as _'reply(result)'_ is called. 

#### Request Logging

In addition to the [General Events Logging](#general-events-logging) mechanism provided to log non-request-specific events, **hapi** provides
a logging interface for individual requests. By associating log events with the request responsible for them, it is easier to debug and understand
the server's behavior. It also enables batching all the request log events and deliver them to the monitor as a single package.

The request object is also decorated with the following methods.
- _'log(tags, [data, timestamp])'_ which adds a record to the request log where:
  - _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the logged event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.
  - _'data'_ - an optional message string or object with the application data being logged.
  - _'timestamp'_ - an optional timestamp override (if not present, the server will use current time), expressed in milliseconds since 1970 (_new Date().getTime()_).
- _'request.getLog(tags)'_ - Returns an array of events which match the tag(s) specifed.
  - _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the logged event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.

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

The route `config.query` defines the query validation rules performed before the route handler is invoked. Supported values:
- _'false'_ or _'null'_ - no query parameters allowed. This is the default.
- _'true'_ - any query parameters allowed (no validation performed).
- a validation rules object as described in [Data Validation](#data-validation).

### Payload Validation

The route `config.schema` defines the payload validation rules performed before the route handler is invoked. Supported values:
- _'null'_ - any payload allowed (no validation performed). This is the default.
- _'false'_ - no query parameters allowed.
- a validation rules object as described in [Data Validation](#data-validation).

### Caching

'GET' routes may be configured to use the built-in cache if enabled using the server `cache` option. The route caching rules can consist of
a single rule or an array of rules. Rules consist of:
- `match` - a regular expression matched against the request path and query (e.g. '/p/a/t/h?query=string') to determine if the rule applies to the requested resource. `match` is required for an array of rules and forbidden for single rule (which will match all resources for the configured route).
- `isCached` - determines if the matching resource is cached. Defaults to true. Can be used to exclude a subset of resources from caching.
- `expiresInSec` - relative expiration expressed in the number of seconds since the item was saved in the cache. Cannot be used together with `expiresAt`.
- `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which cache records expire. Cannot be used together with `expiresInSec`.

If more than one rule is configured, the rules are matched against the request in order until the first match. If none match the cache is not used.

## Data Validation

**hapi** supports a rich set of data types and validation rules which are described in detail in [Validation Configuration](./docs/ValidationConfig.md).
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

## Errors

The 'Hapi.Error' module provides helper methods to generate error responses:
- _'badRequest([message])'_ - HTTP 400 (Bad request).
- _'unauthorized([message])'_ - HTTP 401 (Unauthorized).
- _'forbidden([message])'_ - HTTP 403 (Not allowed).
- _'notFound([message])'_ - HTTP 404 (Not found).
- _'internal([message, data])'_ - HTTP 500 (Internal error). The optional _message_ and _data_ values are not returned to the client but are logged internally.
- _'create(message, code, text, [options]) - creates a custom error with the provided _message_, _code_ (the HTTP status code), _text_ (the HTTP status message), and any keys present in _options_.

The _message_ value is optional and will be returned to the client in the response unless noted otherwise. For example:

```javascript
function onUnknownRoute(request) {

    request.reply(Hapi.Error.unknown('Sorry, nobody home'));
}
```

Error responses are send as JSON payload with the following keys (unless an [error response override](#errors) is configured):
- _code_ - the HTTP status code (e.g. 400).
- _error_ - the HTTP status message (e.g. 'Bad request').
- _message_ - the returned message if provided.

The complete error repsonse including any additional data is added to the request log.

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

