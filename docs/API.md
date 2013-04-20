# 1.0.x API Reference

## `Server`

#### `new Server([host], [port], [options])`

Creates a new server instance with the following arguments:
- `host` - the hostname or IP address the server is bound to. Defaults to `0.0.0.0` which means any available network
  interface. Set to `127.0.0.1` or `localhost` to restrict connection to those coming from the same machine.
- `port` - the TPC port the server is listening to. Defaults to port `80` for HTTP and to `443` when TLS is configured.
  to use an ephemeral port, use `0` and once the server is started, retrieve the port allocation via `server.info.port`.
- `options` - An object with the server configuration as described in [Server configuration](#server-configuration).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server('localhost', 8000, { cors: true });
```

Alternatively, `createServer([host], [port], [options])` can be called:

```javascript
var Hapi = require('hapi');
var server = Hapi.createServer('localhost', 8000, { cors: true });
```

### Server configuration

When creating a server instance, the following options configure the server's behaviour:

- `app` - application-specific configuration. Provides a safe place to store application configuration without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
<p></p>
- `auth` - configures one or more authentication strategies. The `auth` key can be set to a single strategy object (the name will default to `'default'`),
  or to an object with multiple strategies where the strategy name is the object key. The authentication strategies and their options are described in
  [`server.auth()`](#serverauthname-options).
<p></p>
- `cache` - determines the type of server-side cache used. Every server includes a cache for storing and reusing request responses and helper results.
  By default a simple memory-based cache is used which has very limited capacity and is not suitable for production environments. In addition to the
  memory cache, a Redis-based or a MongoDB-based cache can be configured. Actual caching is only utilized if routes, helpers, and plugins are explicitly
  configured to store their state in the cache. The server cache configuration only defines the store itself. The `cache` options are described in
  the [**catbox** module documentation](https://github.com/spumko/catbox#client).
<p></p>
- `cors` - the [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows browsers to make cross-origin API calls. CORS is
  required by web application running inside a browser which are loaded from a different domain than the API server. CORS headers are disabled by
  default. To enable, set `cors` to `true`, or to an object with the following options:
    - `origin` - a strings array of allowed origin servers ('Access-Control-Allow-Origin'). Defaults to any origin `['*']`.
    - `maxAge` - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it
      will take before the browser checks for changes in policy. Defaults to `86400` (one day).
    - `headers` - a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to `['Authorization', 'Content-Type', 'If-None-Match']`.
    - `additionalHeaders` - a strings array of additional headers to `headers`. Use this to keep the default headers in place.
    - `methods` - a strings array of allowed HTTP methods ('Access-Control-Allow-Methods'). Defaults to `['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']`.
    - `additionalMethods` - a strings array of additional methods to `methods`. Use this to keep the default methods in place.
    - `exposedHeaders` - a strings array of exposed headers ('Access-Control-Expose-Headers'). Defaults to `['WWW-Authenticate', 'Server-Authorization']`.
    - `additionalExposedHeaders` - a strings array of additional headers to `exposedHeaders`. Use this to keep the default headers in place.
    - `credentials` - if `true`, allows user credentials to be sent ('Access-Control-Allow-Credentials'). Defaults to `false`.
<p></p>
- `debug` - controls the error types sent to the console:
    - `request` - a string array of request log tags to be displayed via `console.error()` when the events are logged via `request.log()`. Defaults
      to uncaught errors thrown in external code (these errors are handled automatically and result in an Internal Server Error (500) error response.
      For example, to display all errors, change the option to `['error', 'uncaught']`. To turn off all console debug messages set it to `false`.
<p></p>
- <a name="server.config.files" />``files` - defines the behaviour for serving static resources using the built-in route handlers for files and directories:
    - `relativeTo` - determines how relative paths are resolved. Available values:
        - `'cwd'` - relative paths are resolved using the active process path (`process.cwd()`). This is the default setting.
        - `'routes'` - relative paths are resolved relative to the source file in which the `server.route()` method is called. This means the
          location of the source code determines the location of the static resources when using relative paths.
        - an absolute path (e.g. '/path') used as prefix for all relative paths.
<p></p>
- `labels` - a string array of labels used when registering plugins to [`pack.select()`](#packselectlabels) matching server labels. Defaults
  to an empty array `[]` (no labels).
<p></p>
- `location` - used to convert relative 'Location' header URIs to absolute, by adding this value as prefix. Value must not contain a trailing `'/'`.
  Defaults to empty string (`''`).
<p></p>
- <a name="server.config.payload" />`payload` - controls how incoming payloads (request body) are processed:
    - `maxBytes` - limits the size of incoming payloads to the specified byte count. Allowing very large payloads may cause the server to run
      out of memory. Defaults to `1048576` (1MB).
<p></p>
- `plugins` - plugin-specific configuration. Provides a place to store and pass plugin configuration that is at server-level. The `plugins` is
  an object where each key is a plugin name and the value is the configuration.
<p></p>
- <a name="server.config.router" />`router` - controls how incoming request URIs are matched against the routing table:
    - `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to `true`.
    - `normalizeRequestPath` - determines whether request paths should be normalized prior to matching. Normalization percent-encodes reserved
      characters, decodes unreserved characters, and capitalizes any percent encoded values. Useful when serving non-compliant HTTP clients.
      Defaults to `false`.
<p></p>
- <a name="server.config.state" />`state` - HTTP state management (cookies) allows the server to store information on the client which is sent back to the server with every
  request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)).
    - `cookies` - The server automatically parses incoming cookies based on these options:
        - `parse` - determines if incoming 'Cookie' headers are parsed and stored in the `request.cookies` object. Defaults to `true`.
        - `failAction` - determines how to handle cookie parsing errors. Allowed values are:
            - `'error'` - return a Bad Request (400) error response. This is the default value.
            - `'log'` - report the error but continue processing the request.
            - `'ignore'` - take no action.
        - `clearInvalid` - if `true`, automatically instruct the client to remove invalid cookies. Defaults to `false`.
<p></p>
- `timeout` - define timeouts for processing durations:
    - `server` - response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an incoming client request before giving
      up and responding with a Service Unavailable (503) error response. Disabled by default (`false`).
    - `client` - request timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body) before giving up
      and responding with a Request Timeout (408) error response. Set to `false` to disable. Defaults to `10000` (10 seconds). 
    - `socket` - by default, node sockets automatically timeout after 2 minutes. Use this option to override this behaviour. Defaults to `undefined`
      which leaves the node default unchanged. Set to `false` to disable socket timeouts.
<p></p>
- `tls` - used to create an HTTPS server. The `tls` object is passed unchanged as options to the node.js HTTPS server as described in the
  [node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).
<p></p>
- <a name="server.config.views" />`views` - enables support for view rendering (using templates to generate responses). Disabled by default.
  To enable, set to an object with the following options:
    - `engines` - (required) an object where each key is a file extension (e.g. 'html', 'jade'), mapped to the npm module name (string) used for
      rendering the templates. Alternatively, the extension can be mapped to an object with the following options:
        - `module` - the npm module name (string) to require or an object with:
            - `compile(template, options)` - rendering function. Returns a function with signature `function(context, options)`. Follows the
              convention used in [handlebars](https://github.com/wycats/handlebars.js/).
        - any of the `views` options listed below (except `defaultExtension`) to override the defaults for a specific engine.
    - `defaultExtension` - defines the default filename extension to append to template names when multiple engines are configured and not
      explicit extension is provided for a given template. No default value.
    - `path` - the root file path used to resolve and load the templates identified when calling `request.reply.view()`. Defaults to current working
      directory.
    - `partialsPath` - the root file path where partials are located. Defaults to no partials support (empty path).
    - `basePath` - a base path used as prefix for `path` and `partialsPath`. No default.
    - `layout` - if set to `true`, layout support is enabled. The layout template name must be 'layout.ext' where 'ext' is the engine's extension.
      Defaults to `false`.
    - `layoutKeyword` - the key used by the template engine to denote where primary template content should go. Defaults to `'content'`.
    - `encoding` - the text encoding used by the templates when reading the files and outputing the result. Defaults to `'utf-8'`.
    - `isCached` - if set to `false`, templates will not be cached (thus will be read from file on every use). Defaults to `true`.
    - `allowAbsolutePaths` - if set to `true`, allows absolute template paths passed to `request.reply.view()`. Defaults to `false`.
    - `allowInsecureAccess` - if set to `true`, allows template paths passed to `request.reply.view()` to contain '../'. Defaults to `false`.
    - `compileOptions` - options object passed to the engine's compile function. Defaults to empty options `{}`.
    - `runtimeOptions` - options object passed to the returned function from the compile operation. Defaults to empty options `{}`.
    - `contentType` - the content type of the engine results. Defaults to `'text/html'`.

### `Server` properties

Each instance of the `Server` object have the following properties:
- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `helpers` - helper functions registered with [`server.helper()`](#serverhelpername-method-options).
- `info` - server information:
    - `port` - the port the server was configured to (before `start()`) or bound to (after `start()`).
    - `host` - the hostname the server was configured to (defaults to `'0.0.0.0'` if no host was provided).
    - `uri` - a string with the following format: 'protocol://host:port' (e.g. 'http://example.com:8080').
- `listener` - the node HTTP server object.
- `pack` - the [`Pack`](#pack) object the server belongs to (automatically assigned when creating a server instance directly).
- `plugins` - an object with each key is a plugin name and the value is the API registered by that plugin using [`plugin.api()`](#pluginapikey-value).
- `settings` - an object containing the [server configuration](#server-configuration) after applying the defaults.

### `Server` methods

#### `server.start([callback])`

Starts the server by listening for incoming connections on the configured port. If provided, `callback()` is called once the server is
ready for new connections. If the server is already started, the `callback()` is called on the next tick.

```javascript
var Hapi = require('hapi');
var server = new Hapi();
server.start(function () {

    console.log('Server started at: ' + server.info.uri);
});
```

#### `server.stop([options], [callback])`

Stops the server by refusing to accept any new connections. Existing connections will continue until closed or timeout (defaults to 5 seconds).
Once the server stopped, all the connections have ended, and it is safe to exit the process, the callback (if provided) is called. If the server
is already stopped, the `callback()` is called on the next tick.

The optional `options` object supports:
- `timeout` - overrides the timeout in millisecond before forcefully terminating a connection. Defaults to `5000` (5 seconds).

```javascript
server.stop({ timeout: 60 * 1000 }, function () {

    console.log('Server stopped');
});
```

#### `server.route(options)`

Adds a new route to the server with the following options:
- `path` - (required) the absolute path used to match incoming requests (must begin with '/'). Incoming requests are compared to the configured
  paths based on the server [`router`](#server.config.router) configuration option. The path can include named parameters enclosed in `{}` which
  will be matched against litertal values in the request as described in [Path parameters](#path-parameters).
<p></p>
- `method` - (required) the HTTP method. Typically one of _'GET, POST, PUT, DELETE, OPTIONS'_. Any HTTP method is allowed, except for _'HEAD'_.
  Use `*` to match against any HTTP method (only when an exact match was not found).
<p></p>
- `vhost` - an optional domain string or an array of domain strings for limiting the route to only requests with a matching host header field.
  Matching is done against the hostname part of the header only (excluding the port). Defaults to all hosts.
<p></p>
- `handler` - (required) the function called to generate the response after successful authentication and validation. The handler function is
  described in [Route handler](#route-handler). Alternatively, the `handler` option can be assigned an object with one of:
    - `file` - generates a static file endpoint for serving a single file. `file` can be set to:
        - a relative or absolute file path string (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
        - a function with the signature `function(request)` which returns the relative or absolute file path.
        - an object with the following options:
            - `path` - a path string or function as described above.
            - `mode` - specifies whether to include the 'Content-Disposition' header with the response. Available values:
                - `false` - header is not included. This is the default value.
                - `'attachment'`
                - `'inline'`
<p></p>
    - `directory` - generates a directory endpoint for serving static content from a directory. Routes using the directory handler must include a
      single path parameter at the end of the path string (e.g. '/path/to/somewhere/{param}' where the parameter name does not matter). The path
      parameter can use any of the parameter options (e.g. '{param}' for one level files only, '{param?}' for one level files or the directory root,
      '{param*}' for any level, or '{param*3}' for a specific level). The directory handler is an object with the following options:
        - `path` - (required) the directory root path (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
          Value can be:
            - a single path string used as the prefix for any resources requested by appending the request path parameter to the provided string.
            - an array of path strings. Each path will be attemped in order until a match is found (by following the same process as the single path string).
            - a function with the signature `function(request)` which returns the path string.
        - `index` - optional boolean, determines if 'index.html' will be served if found in the folder when requesting a directory. Defaults to `true`.
        - `listing` - optional boolean, determines if directory listing is generated when a directory is requested without an index document. Defaults to _'false'_.
        - `showHidden` - optional boolean, determines if hidden files will be shown and served. Defaults to `false`.
<p></p>
    - `proxy` - generates a reverse proxy handler with the following options:
        - `host` - the upstream service host to proxy requests to.  The same path on the client request will be used as the path on the host.
        - `port` - the upsteram service port.
        - `protocol` - The protocol to use when making a request to the proxied host:
            - `'http'`
            - `'https'`
        - `passThrough` - if `true`, forwards the headers sent from the client to the upstream service being proxied to. Defaults to `false`.
        - `xforward` - if `true`, sets the 'X-Forwarded-For', 'X-Forwarded-Port', 'X-Forwarded-Proto' headers when making a request to the
          proxied upstream endpoint. Defaults to `false`.
        - `mapUri` - a function used to map the request URI to the proxied URI. The function signature is `function(request, callback)` where:
            - `request` - is the incoming request object
            - `callback` - is `function(err, uri)` where `uri` is the absolute proxy URI. Cannot be used together with `host`, `port`, or `protocol`.
        - `postResponse` - a custom function for processing the response from the upstream service before sendint to the client. Useful for
          custom error handling of responses from the proxied endpoint or other payload manipulation. Function signature is
          `function(request, settings, res, payload)` where:
              - `request` - is the incoming request object. It is the responsibility of the `postResponse()` function to call `request.reply()`.
              - `settings` - the proxy handler configuration.
              - `res` - the node response object received from the upstream service.
              - `payload` - the response payload.
        - `httpClient` - an alternative HTTP client function, compatible with the [`request`](https://npmjs.org/package/request) module `request()`
          interface.
<p></p>
    - `view` - generates a template-based response. The `view` options is set to the desired template file name. The view context available to the template
      includes:
        - `payload` - maps to `request.payload`.
        - `params` - maps to `request.params`.
        - `querystring` - maps to `request.query`.
<p></p>
- `config` - additional route configuration (the `config` options allows splitting the route information from its implementation):
    - `handler` - an alternative location for the route handler function. Same as the `handler` option in the parent level. Can only
      include one handler per route.
<p></p>
    - `pre` - an array with prerequisites methods which are executed in serial or in parallel before the handler is called and are
      described in [Route prerequisites](#prerequisites).
<p></p>
    - `validate`
        - `query` - validation rules for an incoming request query component (the key-value part of the URI between '?' and '#'). Defaults to
          all query parameters allowed. Described in [Query validation](#query-validation).
        - `payload` - validation rules for an incoming request payload (request body). Defaults to no validation (any payload allowed).
          Set to `false` to forbid payloads. Described in [Payload validation](#payload-validation) for more information.
        - `path` - validation rules for incoming request path parameters. Defaults to no validation (all path parameter values allowed).
          Described in [Path validation](#path-validation).
<p></p>
        - `response` - validation rules for the outgoing response payload (response body). Defaults to no validation (any response allowed).
          Set to an empty object `{}` to forbid response payloads. Described in [Response validation](#response-validation). Takes an object
          with the following options:
            - `schema` - the validation schema.
            - `sample` - the percent of responses validated (0 - 100). Set to `0` to disable all validation. Defaults to `100` (all responses).
            - `failAction` - defines what to do when a response fails validation. Options are:
                - `'error'` - return an Internal Server Error (500) error response. This is the default value.
                - `'log'` - log the error but send the response.
<p></p>
    - `payload` - determines how the request payload is processed. Defaults to `'parse'` if `validate.payload` is set or when `method` is
      `'POST'` or `'PUT'`, otherwise `'stream'`. Payload processing is configured using the server [`payload`](#server.config.payload) configuration.
       Options are:
        - `'stream'` - the incoming request stream is left untouched, leaving it up to the handler to process the request via `request.raw.req`.
        - `'raw'` - the payload is read and stored in `request.rawPayload` as a Buufer and is not parsed.
        - `'parse'` - the payload is read and stored in `request.rawPayload` as a Buffer, and then parsed (JSON or form-encoded) and stored
          in `request.payload`. Parsing is performed based on the incoming request 'Content-Type' header. If the parsing is enabled and the
          format is unknown, a Bad Request (400) error response is sent. The supported mime types are:
            - application/json
            - application/x-www-form-urlencoded
            - multipart/form-data ([formidable](https://npmjs.org/package/formidable) is used for processing this data and is capable of
              receiving files as well as other form data.  All values are assigned to their respective form names in `request.payload`.
<p></p>
    - `cache` - if the the route method is 'GET', the route can be configured to use the cache. The `cache` options are described in
      the [**catbox** module documentation](https://github.com/spumko/catbox#policy) with some additions:
        - `mode` - cache location. Available values:
            - `'client'` - caching is pefromed on the client by sending the HTTP `Cache-Control` header. This is the default value.
            - `'server'` - caching is performed on the server using the cache strategy configured.
            - `'client+server'` - caching it performed on both the client and server.
        - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
          together with `expiresAt`.
        - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
          expire. Cannot be used together with `expiresIn`.
        - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it.  Must be less than `expiresIn`.
        - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
<p></p>
    - `auth` - authentication configuration. Value can be:
        - a string with the name of an authentication strategy registered with `server.auth()`.
        - a boolean where `false` means no authentication, and `true` means used the `'default'` authentication strategy.
        - an object with:
            - `mode` - the authentication mode. Defaults to `'required'` if a server authentication strategy is configured, otherwise defaults
              to no authentication. Available values:
                - `'required'` - authentication is required.
                - `'optional'` - authentication is optional (must be valid if present).
                - `'try'` - same as `'optional'` but allows for invalid authentication.
            - `strategies` - a string array of strategy names in order they should be attempted. If only one strategy is used, `strategy` can
              be used instead. Defaults to `'default'`.
            - `payload` - if set, the payload (in requests other than 'GET' and 'HEAD') is authenticated after it is processed. Requires a strategy
              with payload authentication support (e.g. [Hawk](Hawk authentication)). Available values:
                - `false` - no payload authentication. This is the default value.
                - `'required'` - payload authentication required.
                - `'optional'` - payload authentication performed only when the client includes payload authentication information (e.g.
                  `hash` attribute in Hawk).
            - `tos` - minimum terms-of-service version required (uses the [semver](https://npmjs.org/package/semver) module). If defined, the
              authentication credentials object must include a `tos` key which satisfies this requirement. Defaults to `false` which means no validation.
            - `scope` - required application scope. A scope string which must be included in the authentication credentials object in `scope` which is
              a string array. Defaults to no scope required.
            - `entity` - the required authenticated entity type. If set, must match the `entity` value of the authentication credentials. Available
              values:
                - `any` - the authentication can be on behalf of a user or application. This is the default value.
                - `user` - the authentication must be on behalf of a user.
                - `app` - the authentication must be on behalf of an application.
<p></p>
    - `description` - route description used for generating documentation (string).
    - `notes` - route notes used for generating documentation (string or array of strings).
    - `tags` - route tags used for generating documentation (array of strings).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

// Handler in top level

var status = function () {

    this.reply('ok');
};

server.route({ method: 'GET', path: '/status', handler: status });

// Handler in config

var user = {
    cache: { expiresIn: 5000 },
    handler: function () {

        this.reply({ name: 'John' });
    }
};

server.route({ method: 'GET', path: '/user', config: user });
```

##### Path processing

The router iterates through the routing table on each incoming request and executes the first (and only the first) matching route. Route
matching is done on the request path only (excluding the query and other URI components). Requests are matches in a deterministic order where
the order in which routes are added does not matter. The routes are sorted from the most specific to the most generic. For example, the following
path array shows the order in which an incoming request path will be matched against the routes:

```javascript
var paths = [
    '/',
    '/a',
    '/b',
    '/ab',
    '/{p}',
    '/a/b',
    '/a/{p}',
    '/b/',
    '/a/b/c',
    '/a/b/{p}',
    '/a/{p}/b',
    '/a/{p}/c',
    '/a/{p*2}',
    '/a/b/c/d',
    '/a/b/{p*2}',
    '/a/{p}/b/{x}',
    '/{p*5}',
    '/a/b/{p*}',
    '/{p*}'
];
```

##### Path parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming request path at that path segment. For example,
'/book/{id}/cover' will match '/book/123/cover' and `request.params.id` will be set to `'123'`. Each path segment (everything between the opening '/' and
 the closing '/' unless it is the end of the path) can only include one named parameter.
 
 An optional '?' suffix following the parameter name indicates an optional parameter (only allowed if the parameter is at the ends of the path).
 For example, the route '/book/{id?}' matches '/book/'.

```javascript
var getAlbum = function () {

    this.reply('You asked for ' +
                (this.params.song ? this.params.song + ' from ' : '') +
                this.params.album);
};

server.route({
    path: '/{album}/{song?}',
    method: 'GET',
    handler: getAlbum
});
```

In addition to the optional '?' suffix, a parameter name can also specify the number of matching segments using the '*' suffix, followed by a number
greater than 1. If the number of expected parts can be anything, then use '*' without a number (matchin any number of segments can only be used in the
last path segment).

```javascript
var getPerson = function () {

    var nameParts = this.params.name.split('/');
    this.reply({ first: nameParts[0], last: nameParts[1] });
};

server.route({
    path: '/person/{name*2}',   // Matches '/person/john/doe'
    method: 'GET',
    handler: getPerson
});
```

##### Route handler

When a route is matched against an incoming request, the route handler is called and passed a reference to the [request](#request) object.
The handler method must call [`request.reply()`](#requestreply) or one of its sub-methods to return control back to the router.

Route handler functions can use one of three declaration styles:

No arguments (the request object is bound to `this`, decorated by the `reply` interface):
```javascript
var handler = function () {

    this.reply('success');
};
```

One argument (the request is passed as an argument, decorated by the `reply` interface):
```javascript
var handler = function (request) {

    request.reply('success');
};
```

Two arguments (the request and the `reply` interface are passed as arguments):
```javascript
var handler = function (request, reply) {

    reply('success');
};
```

The two-arguments style is provided for symmetry with extension functions and prerequisite functions where the function
signature is `function(request, next)`. In order to enable interchangeable use of these functions, the two argument style does
not provide any of the [`request.reply`](#requestreply) decorations.

#### `server.route(routes)`

Same as [server.route(options)](#serverrouteoptions) where `routes` is an array of route options.

```javascript
server.route([
    { method: 'GET', path: '/status', handler: status },
    { method: 'GET', path: '/user', config: user }
]);
```

#### `server.routingTable()`

Returns a copy of the routing table. The return value is an array of routes where each route contains:
- `settings` - the route config with defaults applied.
- `method` - the HTTP method in lower case.
- `path` - the route path.

```javascript
var table = server.routingTable()
console.log(table);

/*  Output:

    [{
        method: 'get',
        path: '/test/{p}/end',
        settings: {
            handler: [Function],
            method: 'get',
            plugins: {},
            app: {},
            validate: {},
            payload: 'stream',
            auth: undefined,
            cache: [Object] }
    }] */
```

#### `server.log(tags, [data, [timestamp]])`

The `server.log()` method is used for logging server events that cannot be associated with a specific request. When called the server emits a `'log'`
event which can be used by other listeners or plugins to record the information or output to the console. The arguments are:
- `tags` - a string or an array of strings (e.g. `['error', 'database', 'read']`) used to identify the event. Tags are used instead of log levels
  and provide a much more expressive mechanism for describing and filtering events. Any logs generated by the server internally include the `'hapi'`
  tag along with event-specific information.
- `data` - an optional message string or object with the application data being logged.
- `timestamp` - an optional timestamp expressed in milliseconds. Defaults to `Date.now()` (now).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.on('log', function (event, tags) {

    if (tags.error) {
        console.log(event);
    }
});

server.log(['test','error'], 'Test event');
```

#### `server.state(name, options)`

[HTTP state management](http://tools.ietf.org/html/rfc6265) uses client cookies to persist a state across multiple requests. Cookie definitions
can be registered with the server using the `server.state()` method, where:
- `name` - is the cookie name.
- `options` - are the optional cookie settings:
    - `ttl` - time-to-live in milliseconds. Defaults to `null` (session timelife - cookies are deleted when the browser is closed).
    - `isSecure` - sets the 'Secure' flag. Defaults to `false`.
    - `isHttpOnly` - sets the 'HttpOnly' flag. Defaults to `false`.
    - `path` - the path scope. Defaults to `null` (no path).
    - `domain` - the domain scope. Defaults to `null` (no domain).
    - `autoValue` - if present and the cookie was not received from the client or explicitly set by the route handler, the cookie is automatically
      added to the response with the provided value.
    - `encoding` - encoding performs on the provided value before serialization. Options are:
        - `'none'` - no encoding. When used, the cookie value must be a string. This is the default value.
        - `'base64'` - string value is encoded using Base64.
        - `'base64json'` - object value is JSON-stringified than encoded using Base64.
        - `'form'` - object value is encoded using the _x-www-form-urlencoded_ method.
        - `'iron'` - Encrypts and sign the value using [**iron**](https://github.com/hueniverse/iron).
    - `sign` - an object used to calculate an HMAC for cookie integrity validation. This does not provide privacy, only a mean to verify that the cookie value
      was generated by the server. Redundent when `'iron'` encoding is used. Options are:
        - `integrity` - algorithm options. Defaults to [`require('iron').defaults.integrity`](https://github.com/hueniverse/iron#options).
        - `password` - password used for HMAC key generation.
    - `password` - password used for `'iron'` encoding.
    - `iron` - options for `'iron'` encoding. Defaults to [`require('iron').defaults`](https://github.com/hueniverse/iron#options).

```javascript
// Set cookie definition

server.state('session', {
    ttl: 24 * 60 * 60 * 1000,     // One day
    isSecure: true,
    path: '/',
    encoding: 'base64json'
});

// Set state in route handler

var handler = function () {

    var session = this.state.session;
    if (!session) {
        session = { user: 'joe' };
    }

    session.last = Date.now();

    this.reply('Success').state('session', session);
};
```

Registered cookies are automatically parsed when received. Parsing rules depends on the server [`state.cookies`](#server.config.state) configuration.
If an incoming registered cookie fails parsing, it is not included in `request.state`, regardless of the `state.cookies.failAction` setting.
When `state.cookies.failAction` is set to `'log'` and an invalid cookie value is received, the server will emit a `'request'` event. To capture these errors
subscribe to the `'request'` events and filter on `'error'` and `'state'` tags:

```javascript
server.on('request', function (request, event, tags) {
    
    if (tags.error && tags.state) {
        console.error(event);
    } 
});
```

#### `server.views(options)`

Initializes the server views manager programatically instead of via the server [`views`](#server.config.views) configuration option.
The `options` object is the same as [`views`](#server.config.views).

```javascript
server.views({
    engines: {
        html: 'handlebars',
        jade: 'jade'
    },
    path: '/static/templates'
});
```

#### `server.auth(name, options)`

Registers an authentication strategy where:
- `name` - is the strategy name (`'default'` is automatically assigned if a single strategy is registered via the server `auth` config).
- `options` - required strategy options. Each scheme comes with its own set of required options, in addition to the options shared
  by all schemes:
    - `scheme` - (required, except when `implementation` is used) the built-in scheme name. Availavble values:
        - `'basic'` - [HTTP Basic authentication](#basic-authentication) ([RFC 2617](http://tools.ietf.org/html/rfc2617))
        - `'cookie'` - [cookie authentication](#cookie-authentication)
        - `'hawk'` - [HTTP Hawk authentication](#hawk-authentication) ([Hawk protocol](https://github.com/hueniverse/hawk))
        - `'bewit'` - [URI Bewit (Hawk)](#bewit-authentication) query authentication ([Hawk protocol](https://github.com/hueniverse/hawk))
    - `implementation` -  an object with the **hapi** authenticatin scheme interface (use the `'hawk'` implementation as template). Cannot be used together with `scheme`.
    - `defaultMode` - if `true`, the scheme is automatically assigned as a required strategy to any route without an `auth` config. Can only be assigned to a single
      server strategy. Value must be `true` (which is the same as `'required'`) or a valid authentication mode (`'required'`, `'optional'`, `'try'`). Defaults to `false`.
      
##### Basic authentication

Basic authentication requires validating a username and password combination. The `'basic'` scheme takes the following required options:
- `scheme` - set to `'basic'`.
- `validateFunc` - a user lookup and password validation function with the signature `function(username, password, callback)` where:
    - `username` - the username received from the client.
    - `password` - the password received from the client.
    - `callback` - a callback function with the signature `function(err, isValid, credentials)` where:
        - `err` - an internal error.
        - `isValid` - `true` if both the username was found and the password matched, otherwise `false`.
        - `credentials` - a crendetials object passed back to the application in `request.auth.credentials`. Typically, `credentials` are only
          included when `isValid` is `true`, but there are cases when the application needs to know who tried to authenticate even when it fails
          (e.g. with authentication mode `'try'`).

```javascript
var Bcrypt = require('bcrypt');

var users = {
    john: {
        username: 'john',
        password: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm',   // 'secret'
        name: 'John Doe',
        id: '2133d32a'
    }
};

var validate = function (username, password, callback) {

    var user = users[username];
    if (!user) {
        return callback(null, false);
    }

    Bcrypt.compare(password, user.password, function (err, isValid) {

        callback(err, isValid, { id: user.id, name: user.name });
    });
};

server.auth('simple', {
    scheme: 'basic',
    validateFunc: validate
});

server.route({ method: 'GET', path: '/', config: { auth: 'simple' } });
```

##### Cookie authentication

Cookie authentication provides a simple cookie-based session management. The user has to be authenticated via other means, typically a web
form, and upon successful authentication, receive a reply with a session cookie. Subsequent requests containing the session cookie are authenticated
(the cookie uses [Iron](https://github.com/hueniverse/iron) to encrypt and sign the session content) and validated via the provided `validateFunc`
in case the cookie's encrypted content requires validation on each request. Note that cookie operates as a bearer token and anyone in possession
of the cookie content can use it to imperssonate its true owner. The `'cookie`' scheme takes the following required options:
- `scheme` - set to `'cookie'`.
- `cookie` - the cookie name. Defaults to `'sid'`.
- `password` - used for Iron cookie encoding.
- `ttl` - sets the cookie expires time in milliseconds. Defaults to single browser session (ends when browser closes).
- `clearInvalid` - if `true`, any authentication cookie that fails validation will be marked as expired in the response and cleared. Defaults to `false`.
- `isSecure` - if `false`, the cookie is allowed to be transmitted over insecure connections which exposes it to attacts. Defaults to `false`.
- `redirectTo` - optional login URI to redirect unauthenticated requests to. Defaults to no redirection.
- `appendNext` - if `true` and `redirectTo` is `true`, appends the current request path to the query component of the `redirectTo` URI using the
  parameter name `'next'`. Set to a string to use a different parameter name. Defaults to `false`.
- `validateFunc` - an optional session validation function used to validate the content of the session cookie on each request. Used to verify that the
  internal session state is still valid (e.g. user account still exists). The function has the signature `function(session, callback)` where:
    - `session` - is the session object set via `request.auth.session.set()`.
    - `callback` - a callback function with the signature `function(err, isValid, credentials)` where:
        - `err` - an internal error.
        - `isValid` - `true` if the content of the session is valid, otherwise `false`.
        - `credentials` - a crendetials object passed back to the application in `request.auth.credentials`. If value is `null` or `undefined`,
          defaults to `session`. If set, will override the current cookie as if `request.auth.session.set()` was called.

When the cookie scheme is enabled on a route, the `request.auth.session` objects is decorated with two methods:
- `set(session)` - sets the current session. Must be called after a successful login to begin the session. `session` must be a non-null object,
  which is set on successful subsequent authentications in `request.auth.credentials`.
- `clear()` - clears the current session. Used to logout a user.

```javascript
var Hapi = require('../lib');

var users = {
    john: {
        id: 'john',
        password: 'password',
        name: 'John Doe'
    }
};

var home = function () {

    this.reply('<html><head><title>Login page</title></head><body><h3>Welcome '
      + this.auth.credentials.name
      + '!</h3><br/><form method="get" action="/logout">'
      + '<input type="submit" value="Logout">'
      + '</form></body></html>');
};


var login = function () {

    if (this.auth.isAuthenticated) {
        return this.reply.redirect('/');
    }

    var message = '';
    var account = null;

    if (this.method === 'post') {
        
        if (!this.payload.username ||
            !this.payload.password) {

            message = 'Missing username or password';
        }
        else {
            account = users[this.payload.username];
            if (!account ||
                account.password !== this.payload.password) {

                message = 'Invalid username or password';
            }
        }
    }

    if (this.method === 'get' ||
        message) {

        return this.reply('<html><head><title>Login page</title></head><body>'
            + (message ? '<h3>' + message + '</h3><br/>' : '')
            + '<form method="post" action="/login">'
            + 'Username: <input type="text" name="username"><br>'
            + 'Password: <input type="password" name="password"><br/>'
            + '<input type="submit" value="Login"></form></body></html>');
    }

    this.auth.session.set(account);
    return this.reply.redirect('/');
};


var logout = function () {

    this.auth.session.clear();
    return this.reply.redirect('/');
};


var http = new Hapi.Server('localhost', 8000, config);

server.auth('session', {
    scheme: 'cookie',
    password: 'secret',
    cookie: 'sid-example',
    redirectTo: '/login'
});

http.route([
    { method: 'GET', path: '/', config: { handler: home, auth: true } },
    { method: '*', path: '/login', config: { handler: login, auth: { mode: 'try' } } },
    { method: 'GET', path: '/logout', config: { handler: logout, auth: true } }
]);

http.start();
```

##### Hawk authentication

[Hawk authentication](https://github.com/hueniverse/hawk) provides a holder-of-key authentication scheme. The scheme supports payload
authentication. The scheme requires the following options:
- `scheme` - set to `'hawk'`.
- `getCredentialsFunc` - credential lookup function with the signature `function(id, callback)` where:
    - `id` - the Hawk credentials identifier.
    - `callback` - the callback function with signature `function(err, credentials)` where:
        - `err` - an internal error.
        - `credentials` - a crendetials object passed back to the application in `request.auth.credentials`. Return `null` or `undefined` to
          indicate unknown credentials (which is not considered an error state).
- `hostHeaderName` - optional name of the HTTP request header used to transmit host information. Defaults to ''host''.

```javascript
var Hapi = require('hapi');

var credentials = {
    d74s3nz2873n: {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
}

var getCredentials = function (id, callback) {
   
    return callback(null, credentials[id]);
};

var server = new Hapi.Server(config);
server.auth('hawk', {
    scheme: 'hawk',
    getCredentialsFunc: getCredentials
});
```

##### Bewit authentication

[Bewit authentication](https://github.com/hueniverse/hawk#single-uri-authorization) provides a short-term access to a protected resource by
including a token (bewit) in the request query, issued by an authorized party. Bewit is a subset of the Hawk protocol. The scheme can only
be used with 'GET' requests and requires the following options:
- `scheme` - set to `'bewit'`.
- `getCredentialsFunc` - credential lookup function with the signature `function(id, callback)` where:
    - `id` - the Hawk credentials identifier.
    - `callback` - the callback function with signature `function(err, credentials)` where:
        - `err` - an internal error.
        - `credentials` - a crendetials object passed back to the application in `request.auth.credentials`. Return `null` or `undefined` to
          indicate unknown credentials (which is not considered an error state).
- `hostHeaderName` - optional name of the HTTP request header used to transmit host information. Defaults to ''host''.

```javascript
var Hapi = require('hapi');

var credentials = {
    d74s3nz2873n: {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
}

var getCredentials = function (id, callback) {
   
    return callback(null, credentials[id]);
};

var server = new Hapi.Server(config);
server.auth('bewit', {
    scheme: 'bewit',
    getCredentialsFunc: getCredentials
});
```

To send an authenticated Bewit request, the URI must contain the `'bewit'` query parameter which can be generated using the Hawk module:
```javascript
var Hawk = require('hawk');

var credentials = {
    id: 'd74s3nz2873n',
    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
    algorithm: 'sha256'
};

var uri = 'http://example.com:8080/endpoint';
var bewit = Hawk.client.getBewit(uri, { credentials: credentials, ttlSec: 60 });
uri += '?bewit=' + bewit;
```

#### `server.ext(event, method, [options])`

Registers an extension function in one of the available extension points listed below where:
- `event` - the event name.
- `method` - a function or an array of functions to be executed at a specified point during request processing. The required extension function signature
  is `function(request, next)` where:
    - `request` - is the incoming request object.
    - `next` - is the callback function the extension method must call to return control over to the router. The function takes an optional `response`
      argument, which will cause the process to jump to the "send response" step, skipping all other steps in between.
- `options` - an optional object with the following:
    - `before` - a string or array of strings of plugin names this method must executed before (on the same event). Otherwise, extension methods are executed
      in the order added.
    - `after` - a string or array of strings of plugin names this method must executed before (on the same event). Otherwise, extension methods are executed
      in the order added.

Each incoming request passes through a pre-defined set of steps, along with optional extensions:
- **`'onRequest'`** extension point
    - always called
    - the `request` object passed to the extension functions is decorated with the `request.setUrl(url)` and `request.setMethod(verb)` methods. Calls to these methods
      will impact how the request is routed and can be used for rewrite rules. 
- Lookup route using request path
- Parse cookies
- **`'onPreAuth'`** extension point
- Authenticate request
- Read and parse payload
- Authenticate request payload
- **`'onPostAuth'`** extension point
- Validate path parameters
- Process query extensions (e.g. JSONP)
- Validate query
- Validate payload
- **`'onPreHandler'`** extension point
- Route prerequisites
- Route handler
- **`'onPostHandler'`** extension point
    - the `request` object passed to the extension function is decorated with the `request.response()` method which returns the response object. The response object may be
      modified. To return a different response (for example, replace an error with an HTML response), return the new response via `next(response)`.
- Validate response payload
- **`'onPreResponse'`** extension point
    - always called
    - the `request` object passed to the extension function is decorated with the `request.response()` method which returns the response object. The response object may be
      modified. To return a different response (for example, replace an error with an HTML response), return the new response via `next(response)`.
- Send response (may emit `'internalError'` event)
- Emits `'response'` event
- Wait for tails
- Emits `'tail'` event

```javascript
var Hapi = require('hapi');
var http = new Hapi.Server();

http.ext('onRequest', function (request, next) {
    
    // Change all requests to '/test'
    request.setUrl('/test');
    next();
});

var handler = function () {

    this.reply({ status: 'ok' });
};

http.route({ method: 'GET', path: '/test', handler: handler });
http.start();

// All requests will get routed to '/test'
```

#### `server.helper(name, method, [options])`

Server helpers are functions registered with the server and can be used throughout the application. The advantage of using helpers is
that they can be configured to use the built-in cache and shared across multiple request handlers. This provides a useful method for
speeding up performance by declaring functions as common utilities with a shared cache.

The signature of helper functions is _'function (arg1, arg2, ..., arg3, next)'_ where next is a function defined as _'function (result)'_.
'result' can be any value or an Error (which must be generated using the **hapi** Error module is the helper is used as a prerequisite method).

To add a helper, use the server's _'addHelper(name, method, options)'_ method where:
- _'name'_ - is a unique helper name used to call the method (e.g. 'server.helpers.name').
- _'method'_ - is the helper function.
- _'options'_ - optional settings where:
    - `cache` - cache configuration as described in [Caching](#caching). `mode` is not allowed.
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

Or used as a prerequisites, by passing a string with the helper invocation using the helper name and passing parameters that are all
members of the request object (without _next_):
```javascript
http.route({
    method: 'GET',
    path: '/user/{id}',
    config: {
        pre: [
            'user(params.id)'
        ],
        handler: function (request) {

            request.reply(request.pre.user);
        }
    }
});
```

#### `server.inject(options, callback)`

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

For example:

```javascript
// Create Hapi server
var http = new Hapi.Server('0.0.0.0', 8080);

// Handler
var get = function (request) {

    request.reply('Success!');
};

// Set routes
http.route({ method: 'GET', path: '/', handler: get });

// Injection options
var req = {
    method: 'get',
    url: '/'
};

http.inject(req, function (res) {

    console.log(res.result || res.readPayload());
});
```


### Server events

The server object emits the following events:
- _'log'_ - [general server events](#server-logging).
- _'request'_ - events generated by the [request logging method](#request-logging). Multiple events per request.
- _'response'_ - emitted after a response is sent back. Includes the request object as value. Single event per request.
- _'tail'_ - emitted when a request finished processing, including any registered tails as described in [Request Tails](#request-tails). Single event per request.
- _'internalError'_ - emitted whenever a 500 response is sent. Single event per request.

When provided, event objects include:
- `timestamp` - the event timestamp
- `id` - if the event relates to a request, the request id
- `tags` - an array of tags (e.g. 'error', 'http')
- `data` - optional event-specific data

The _'log'_ event includes the event object and a tags object (where each tag is a key with the value `true`):
```javascript
server.on('log', function (event, tags) {

    if (tags.error) {
        console.log('Server error: ' + event.data);
    }
});
```

The _'request'_ event includes the request object, the event object, and a tags object (where each tag is a key with the value `true`):
```javascript
server.on('request', function (request, event, tags) {

    if (tags.received) {
        console.log('New request: ' + event.id);
    }
});
```

The _'response'_ and _'tail'_ events include the request object:
```javascript
server.on('response', function (request) {

    console.log('Response sent for request: ' + request.id);
});
```

The _'internalError'_ event includes the request object and the causing Error object:
```javascript
server.on('internalError', function (request, err) {

    console.log('Error response (500) sent for request: ' + request.id + ' because: ' + err.message);
});
```


## `Pack`

#### `new Pack(options)`
#### `pack.server(host, port, options)`
#### `pack.start(callback)`
#### `pack.stop(options, callback)`
#### `pack.require(name, options, callback)`
#### `pack.require(names, callback)`
#### `pack.register(plugin, options, callback)`
#### `pack.allow(permissions)`


## `Composer`

#### `new Composer(manifest)`
#### `composer.compose(callback)`
#### `composer.start(callback)`
#### `composer.stop(callback)`


## `error`

An alias of the [**boom**](https://github.com/spumko/boom) module. Can be accessed via `hapi.error` or `hapi.boom`.

#### `badRequest(message)`
#### `unauthorized(error, scheme, attributes)`
#### `unauthorized(error, wwwAuthenticate)`
#### `clientTimeout(message)`
#### `serverTimeout(message)`
#### `forbidden(message)`
#### `notFound(message)`
#### `internal(message, data)`
#### `passThrough(code, payload, contentType, headers)`


## `response`

#### `Generic`
#### `Cacheable`
#### `Empty`
#### `Obj`
#### `Text`
#### `Stream`
#### `File`
#### `Directory`
#### `Redirection`
#### `View`
#### `Buffer`


## `utils`

An alias of the [**hoek**](https://github.com/spumko/hoek) module.

#### `version`


## `types`

See [**joi** Types](https://github.com/spumko/joi#type-registry).


## `state`

#### `prepareValue()`


## Plugin Interface

#### `exports.register(plugin, options, next)`

### Selectable methods

#### `plugin.select(labels)`
#### `plugin.length`
#### `plugin.api(key, value)`
#### `plugin.api(obj)`
#### `plugin.route(options)`
#### `plugin.route(routes)`
#### `plugin.state(name, options)`
#### `plugin.auth(name, options)`
#### `plugin.ext(event, method)`

### Root methods

#### `plugin.version`
#### `plugin.hapi`
#### `plugin.app`
#### `plugin.log(tags, data, timestamp)`
#### `plugin.dependency(deps)`
#### `plugin.events`
#### `plugin.views(options)`
#### `plugin.helper(name, method, options)`
#### `plugin.cache(options, segment)`


## `Request`

When the provided route handler method is called, it receives a _request_ object with the following properties:
- _'url'_ - the parsed request URI.
- _'path'_ - the request URI's path component.
- _'method'_ - the request method as a _lowercase_ string. (Examples: `'get'`, `'post'`).
- _'query'_ - an object containing the query parameters.
- _'params'_ - an object containing the path named parameters as described in [Path Parameters](#parameters).
- _'rawPayload'_ - the raw request payload Buffer (except for requests with `config.payload` set to _'stream'_).
- _'payload'_ - an object containing the parsed request payload (for requests with `config.payload` set to _'parse'_).
- _'state'_ - an object containing parsed HTTP state information (cookies).
- _'session'_ - available for authenticated requests and includes:
    - _'id'_ - session identifier.
    - _'user'_ - user id (optional).
    - _'app'_ - application id (optional).
    - _'scope'_ - approved application scopes (optional).
    - _'ext.tos'_ - terms-of-service version (optional).
- _'server'_ - a reference to the server object.
- _'pre'_ - any requisites as described in [Prequisites](#prequisites).
- _'raw'_ - an object containing the Node HTTP server 'req' and 'req' objects. **Direct interaction with these raw objects is not recommended.**

#### `request.reply()`

**hapi** provides native support for the following response types:
- Empty - an empty response body (content-length of zero).
- Text - plain text. Defaults to 'text/html' content-type.
- Obj - Javascript object, converted to string. Defaults to 'application/json' content-type.
- Stream - a stream object, directly piped into the HTTP response.
- File - transmits a static file. Defaults to the matching mime type based on filename extension.
- Direct - special response type for writing directly to the response object. Used for chunked responses.
- Error - error objects generated using the 'Hapi.error' module or 'new Error()' described in [Response Errors](#response-errors).

Based on the handler function declaration style, a _'reply'_ function is provided which includes the following properties:
- _'payload(result)'_ - sets the provided _'result'_ as the response payload. _'result'_ cannot be a Stream. The method will automatically
  identify the result type and cast it into one of the supported response types (Empty, Text, Obj, or Error). _'result'_ can all be an
  instance of any other response type provided by the 'Hapi.response' module (e.g. File, Direct).
- _'stream(stream)'_ - pipes the content of the stream into the response.
- _'redirect(uri)'_ - sets a redirection response.  Uses the _'server.settings.location'_ prefix when not set to an absolute URI. Defaults to 302.
- _'send()'_ - finalizes the response and return control back to the router. Must be called after _'payload()'_ or _'stream()'_ to send the response.
- _'close()'_ - closes the response stream immediately without flushing any remaining unsent data. Used for ending the handler execution
  after manually sending a response.

For convenience, the reply function can be simply invoke as _'reply([result])'_ which is identical to calling _'reply.payload([result]).send()'_ or _'reply.stream(stream).send()'_, depending on the result.

The 'stream()', and 'redirect()' methods return a **hapi** Response object created based on the result item provided.
Depending on the response type, additional chainable methods are available:
- _'created(location)`_ - a URI value which sets the HTTP response code to 201 (Created) and adds the HTTP _Location_ header with the provided value (normalized to absolute URI). Not available with 'redirect()'.
- _'bytes(length)'_ - a pre-calculated Content-Length header value. Only available when using _'pipe(stream)'_.
- _'type(mimeType)'_ - a pre-determined Content-Type header value. Should only be used to override the built-in defaults.
- _'ttl(msec)'_ - a milliseconds value which overrides the default route cache expiration rule for this individual response.
- _'state(name, value, options)'_ - sets an HTTP state (cookie) as described in [Raw Cookies](#raw-cookies)
- _'unstate(name)'_ - instructs the client to remove the HTTP state.
- _'header(name, value)'_ - sets a HTTP header with the provided value.
- `code(statusCode)` -

The following methods are only available when using 'redirect()':
- _'message(text, type)'_ - a payload message and optional content type (defaults to 'text/html').
- _'uri(dest)'_ - the destination URI.
- _'temporary()_' - sets the status code to 302 or 307 (based on the rewritable settings). Defaults to 'true'.
- _'permanent()_' - sets the status code to 301 or 308 (based on the rewritable settings). Defaults to 'false'.
- _'rewritable(isRewritable)_' - sets the status code to 301/302 (based on the temporary settings) for rewritable (change POST to GET) or 307/308 for non-rewritable. Defaults to 'true'.

The handler must call _'reply()'_, _'reply.send()'_, or _'reply.payload/stream()...send()'_ (and only one, once) to return control over to the router. The reply methods are only available
within the route handler and are disabled as soon as control is returned.


#### `request.addTail([name])`

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
http.route({ method: 'GET', path: '/', handler: get });

// Listen to tail events
http.on('tail', function (request) {

    console.log('Wag the dog');
});

// Start Hapi servers
http.start();
```





#### View

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
        title: 'Views Example',
        message: 'Hello, World'
    });
};

http.route({ method: 'GET', path: '/', handler: handler });
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


The Hapi.Server settings may also be overridden on a per view basis without affecting others:

    request.render.view(tmpl, ctx, { path: '/a/different/path' });

Full working examples covering features such as layouts and partials can be found in the `examples/views/handlebars` folder.






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
    });
};

var server = new Hapi.Server(8080, options);
server.route({ method: 'GET', path: '/', handler: handler });
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
        <title>examples/views/layout.js | Hapi 0.11.1</title>
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
    });
};

var server = new Hapi.Server(3000, options);
server.route({ method: 'GET', path: '/', handler: handler });
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
        <title>examples/views/partials.js | Hapi 0.11.1</title>
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


#### Multiple Engines

Multiple engine support is functional for most templating systems (particularly those that employ a .compile function). Thus,
 multiple templating systems may be used in a single Hapi instance. Custom options may be passed to each .view function to
 customize compile options on a per endpoint basis - the functions behave as they would on a single-engine setup.

Hapi distinguishes between the engines by checking which file extension has been configured by a particular templating engine.

```javascript
var ctx = {
    title: 'examples/views/mixed/basic.js | Hapi ' + Hapi.utils.version(),
    message: 'Hello World!'
}
    
var oneHandler = function (request) {
        
    request.reply.view('index', ctx);
};
    
var twoHandler = function (request) {
        
    request.reply.view('handlebars', ctx);
};
    
var options = {
    views: {
        path: __dirname + '/templates',
        engines: {
            'html': { module: 'handlebars' },
            'jade': { module: 'jade' }
        }
    }
};

var server = new Hapi.Server(3000, options);
server.route({ method: 'GET', path: '/one', handler: oneHandler });
server.route({ method: 'GET', path: '/two', handler: twoHandler });
server.start();
```


#### Request Logging

In addition to the [Server Logging](#server-logging) mechanism provided to log non-request-specific events, **hapi** provides
a logging interface for individual requests. By associating log events with the request responsible for them, it is easier to debug and understand
the server's behavior. It also enables batching all the request log events and deliver them to the monitor as a single package.

The request object is also decorated with the following methods.
- _'log(tags, [data, timestamp])'_ which adds a record to the request log where:
    - _'tags'_ - a single string or an array of strings (e.g. _['error', 'database', 'read']_) used to identify the logged event. Tags are used instead of log levels and provide a much more expressive mechanism for describing and filtering events.
    - _'data'_ - an optional message string or object with the application data being logged.
    - _'timestamp'_ - an optional timestamp override (if not present, the server will use current time), expressed in milliseconds since 1970 (_new Date().getTime()_).
- _'getLog(tags)'_ - Returns an array of events which match the tag(s) specified.

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
http.route({ method: 'GET', path: '/', handler: testLogs });

// Start Hapi servers
http.start();
```

The 'request.log' method is always available.


### Not Found Handler

Whenever a route needs to respond with a simple 404 message use the _'notFound'_ handler.  This can be done by simply setting the route _'handler'_ property to the string 'notFound'.  Below is an example of a route that responds with a 404.
```javascript
{ method: 'GET', path: '/hideme', handler: 'notFound' }
```


### Route Authentication

To override the default authentication settings for a route use the _'auth'_ object on a routes configuration.  Below are the available options for the _'auth'_ configuration on a route.

- `mode` - determines if a route requires authentication.  Options are _none_, _optional_, _try_, and _required_ (defaults to _required_ when the server has authentication configured and _none_ when it doesn't).
    - `none` - authentication is not attempted
    - `optional` - authentication is attempted when the client tries to authenticate.  If authentication fails then an error will be returned to the client.  If the client doesn't try to authenticate then the resource is served without a session being set.
    - `try` - authentication is attempted when the client tries to authenticate.  If authentication fails then the reason is included on the session object but the resource is still served.
    - `required` - the client must be authenticated for the resource to be served, otherwise an error is returned.
- `strategy` - the authentication strategy to use, will use the default strategy if not set.
- `strategies` - an array in priority order of what authentication strategies the route supports.
- `scope` - required session scope in order to access the endpoint.
- `tos` - number that represents terms of service.  Session must have an ext equal or greater than the configured tos value.
- `entity` - the type of object that must exist on the session.  Options are _any_, _user_, and _app_.

When multiple authentication strategies are configured on the server individual routes can specify which of those strategies to use in priority order.  Below is an example showing how to create a route that supports the _'hawk'_ and _'basic'_ strategies and where authentication is optional.

```javascript
{ method: 'GET', path: '/', handler: handler, config: { auth: { strategies: ['hawk', 'basic'], mode: 'optional' } } }
```

If a route doesn't specify the strategy or strategies to use then the servers _'default'_ strategy will be used.  When a single strategy is configured on the server then it will be given the strategy name _'default'_ and will be used by any route that supports authentication.

In a route handler the request object has an _'isAuthenticated'_ property that indicates whether or not the request has been authenticated.

### Query Validation

When a request URI includes a query component (the key-value part of the URI between _?_ and _#_), the query is parsed into its individual
key-value pairs (see [Query String](http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)) and stored in
'request.query'.

The route `config.validate.query` defines the query validation rules performed before the route handler is invoked. Supported values:
- _'true'_ or _'{}'_ - any query parameters allowed (no validation performed).  This is the default.
- _'false'_ - no query parameters allowed.
- a validation rules object as described in [Data Validation](#data-validation).


### Payload Validation

The route `config.validate.payload` defines the payload validation rules performed before the route handler is invoked. Supported values:
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

'GET' routes may be configured to use the built-in cache. The route cache config has the following options:
- `mode` - determines if the route is cached on the server, client, or both. Defaults to _'client'_.
    - `server+client` - Caches the route response on the server and client
    - `client` - Sends the Cache-Control HTTP header on the response to support client caching
    - `server` - Caches the route on the server only
- `segment` - Optional segment name, used to isolate cached items within the cache partition. Defaults to '#name' for server helpers and the
  '/path' fingerprint (the route path with parameters represented by a '?' character) for routes. Note that when using the MongoDB cache
  strategy, some paths will require manual override as their name will conflict with MongoDB collection naming rules. When setting segment
  names manually, helper function segments must begin with '##' and route segments must begin with '//'.
- `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with `expiresAt`.
- `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route expire. Cannot be used together with `expiresIn`.

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


### Prerequisites

Before the handler is called, it is often necessary to perform other actions such as loading required reference data from a database. The `pre` option
allows defining such pre-handler methods. The methods are called in order, unless a `mode` is specified with value 'parallel' in which case, all the parallel methods
are executed first, then the rest in order. The `pre` is a mixed array of functions and objects. If a function is included, it is the same as including an
object with a single `method` key. The object options are:
- `method` - the function to call. The function signature is _'function (request, next)'_. _'next([result])'_ must be called when the operation concludes. If the result is an Error, execution of other prerequisites stops and the error is handled in the same way as when an error is returned from the route handler. The method can be a string invoking a [server helper](#server-helpers).
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
http.route({
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

**hapi** supports a rich set of data types and validation rules which are described in detail in the [**joi** module documentation](http://github.com/spumko/joi).
For example:

```javascript
var Hapi = require('hapi');

var S = Hapi.Types.String;
var I = Hapi.Types.Number;

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

The complete error response including any additional data is added to the request log.


#### Server Route Not Found

**hapi** provides a default handler for unknown routes (HTTP 404). If the application needs to override the default handler, it can add a
new catch-all route for a specific method or all methods:
```javascript
var Hapi = require('hapi');

// Create server
var http = new Hapi.Server(8000);

// Override the default 404 handler
http.route({ method: '*', path: '/{p*}', handler: notFoundHandler });

// Start server
http.start();

// 404 handler
function notFoundHandler() {

    this.reply(Hapi.Error.notFound('The page was not found'));
}
```

## Server Authentication




# The End

hapi hapi, joi joi
