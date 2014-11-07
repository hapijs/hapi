# 7.5.x API Reference

- [`Hapi.Server`](#hapiserver)
    - [`new Server([host], [port], [options])`](#new-serverhost-port-options)
    - [`createServer([host], [port], [options])`](#createserverhost-port-options)
    - [Server options](#server-options)
    - [`Server` properties](#server-properties)
    - [`Server` methods](#server-methods)
        - [`server.start([callback])`](#serverstartcallback)
        - [`server.stop([options], [callback])`](#serverstopoptions-callback)
        - [`server.route(options)`](#serverrouteoptions)
            - [Route options](#route-options)
            - [Path processing](#path-processing)
            - [Path parameters](#path-parameters)
            - [Route handler](#route-handler)
            - [Route prerequisites](#route-prerequisites)
            - [Route not found](#route-not-found)
        - [`server.route(routes)`](#serverrouteroutes)
        - [`server.table([host])`](#servertablehost)
        - [`server.log(tags, [data, [timestamp]])`](#serverlogtags-data-timestamp)
        - [`server.state(name, [options])`](#serverstatename-options)
        - [`server.views(options)`](#serverviewsoptions)
        - [`server.cache(name, options)`](#servercachename-options)
        - [`server.auth.scheme(name, scheme)`](#serverauthschemename-scheme)
        - [`server.auth.strategy(name, scheme, [mode], [options])`](#serverauthstrategyname-scheme-mode-options)
        - [`server.auth.default(options)`](#serverauthdefault-options)
        - [`server.auth.test(strategy, request, next)`](#serverauthteststrategy-request-next)
        - [`server.ext(event, method, [options])`](#serverextevent-method-options)
            - [Request lifecycle](#request-lifecycle)
        - [`server.method(name, fn, [options])`](#servermethodname-fn-options)
        - [`server.method(method)`](#servermethodmethod)
        - [`server.inject(options, callback)`](#serverinjectoptions-callback)
        - [`server.handler(name, method)`](#serverhandlername-method)
        - [`server.location(uri, [request])`](#serverlocationuri-request)
        - [`server.render(template, context, [options], callback)`](#serverrendertemplate-context-options-callback)
    - [`Server` events](#server-events)
- [Request object](#request-object)
    - [`request` properties](#request-properties)
    - [`request` methods](#request-methods)
        - [`request.setUrl(url)`](#requestseturlurl)
        - [`request.setMethod(method)`](#requestsetmethodmethod)
        - [`request.log(tags, [data, [timestamp]])`](#requestlogtags-data-timestamp)
        - [`request.getLog([tags])`](#requestgetlogtags)
        - [`request.tail([name])`](#requesttailname)
    - [`request` events](#request-events)
- [Reply interface](#reply-interface)
    - [Flow control](#flow-control)
    - [`reply([result])`](#replyresult)
    - [`reply.file(path, options)`](#replyfilepath-options)
    - [`reply.view(template, [context, [options]])`](#replyviewtemplate-context-options)
    - [`reply.close([options])`](#replycloseoptions)
    - [`reply.proxy(options)`](#replyproxyoptions)
    - [`reply.redirect(location)`](#replyredirectlocation)
- [Response object](#response-object)
    - [Response events](#response-events)
- [`Hapi.error`](#hapierror)
      - [Error transformation](#error-transformation)
      - [`badRequest([message])`](#badrequestmessage)
      - [`unauthorized(message, [scheme, [attributes]])`](#unauthorizedmessage-scheme-attributes)
      - [`unauthorized(message, wwwAuthenticate)`](#unauthorizedmessage-wwwauthenticate)
      - [`clientTimeout([message])`](#clienttimeoutmessage)
      - [`serverTimeout([message])`](#servertimeoutmessage)
      - [`forbidden([message])`](#forbiddenmessage)
      - [`notFound([message])`](#notfoundmessage)
      - [`internal([message, [data]])`](#internalmessage-data)
- [`Hapi.Pack`](#hapipack)
      - [`new Pack([options])`](#new-packoptions)
      - [`Pack` properties](#pack-properties)
      - [`Pack` methods](#pack-methods)
          - [`pack.server([host], [port], [options])`](#packserverhost-port-options)
          - [`pack.start([callback])`](#packstartcallback)
          - [`pack.stop([options], [callback])`](#packstopoptions-callback)
          - [`pack.register(plugins, options, callback)`](#packregisterplugins-options-callback)
      - [`Pack.compose(manifest, [options], callback)`](#packcomposemanifest-options-callback)
- [Plugin interface](#plugin-interface)
    - [`exports.register(plugin, options, next)`](#exportsregisterplugin-options-next)
    - [Root methods and properties](#root-methods-and-properties)
        - [`plugin.hapi`](#pluginhapi)
        - [`plugin.version`](#pluginversion)
        - [`plugin.app`](#pluginapp)
        - [`plugin.plugins`](#pluginplugins)
        - [`plugin.path(path)`](#pluginpathpath)
        - [`plugin.log(tags, [data, [timestamp]])`](#pluginlogtags-data-timestamp)
        - [`plugin.after(method)`](#pluginaftermethod)
        - [`plugin.views(options)`](#pluginviewsoptions)
        - [`plugin.method(name, fn, [options])`](#pluginmethodname-fn-options)
        - [`plugin.method(method)`](#pluginmethodmethod)
        - [`plugin.methods`](#pluginmethods)
        - [`plugin.cache(options)`](#plugincacheoptions)
        - [`plugin.bind(bind)`](#pluginbindbind)
        - [`plugin.handler(name, method)`](#pluginhandlername-method)
        - [`plugin.render(template, context, [options], callback)`](#pluginrendertemplate-context-options-callback)
    - [Selectable methods and properties](#selectable-methods-and-properties)
        - [`plugin.select(labels)`](#pluginselectlabels)
        - [`plugin.length`](#pluginlength)
        - [`plugin.servers`](#pluginservers)
        - [`plugin.events`](#pluginevents)
        - [`plugin.expose(key, value)`](#pluginexposekey-value)
        - [`plugin.expose(obj)`](#pluginexposeobj)
        - [`plugin.route(options)`](#pluginrouteoptions)
        - [`plugin.route(routes)`](#pluginrouteroutes)
        - [`plugin.state(name, [options])`](#pluginstatename-options)
        - [`plugin.auth.scheme(name, scheme)`](#pluginauthschemename-scheme)
        - [`plugin.auth.strategy(name, scheme, [mode], [options])`](#pluginauthstrategyname-scheme-mode-options)
        - [`plugin.ext(event, method, [options])`](#pluginextevent-method-options)
        - [`plugin.register(plugins, options, callback)`](#pluginregisterplugins-options-callback)
        - [`plugin.dependency(deps, [after])`](#plugindependencydeps-after)
- [`Hapi.state`](#hapistate)
      - [`prepareValue(name, value, options, callback)`](#preparevaluename-value-options-callback)
- [`Hapi.version`](#hapiversion)
- [hapi CLI](#hapi-cli)

## `Hapi.Server`

### `new Server([host], [port], [options])`

Creates a new server instance with the following arguments:

- `host` - the hostname, IP address, or path to UNIX domain socket the server is bound to. Defaults to `0.0.0.0` which
  means any available network interface. Set to `127.0.0.1` or `localhost` to restrict connection to those coming from
  the same machine. If `host` contains a '/' character, it is used as a UNIX domain socket path and if it starts with
  '\\.\pipe' as a Windows named pipe.
- `port` - the TCP port the server is listening to. Defaults to port `80` for HTTP and to `443` when TLS is configured.
  To use an ephemeral port, use `0` and once the server is started, retrieve the port allocation via `server.info.port`.
- `options` - An object with the server configuration as described in [server options](#server-options).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server('localhost', 8000, { cors: true });
```

### `createServer([host], [port], [options])`

An alternative method for creating a server instance using the same arguments as `new Server()`.

```javascript
var Hapi = require('hapi');
var server = Hapi.createServer('localhost', 8000, { cors: true });
```

### Server options

When creating a server instance, the following options configure the server's behavior:

- `app` - application-specific configuration which can later be accessed via `server.settings.app`. Provides a safe
  place to store application configuration without potential conflicts with **hapi**. Should not be used by plugins which
  should use `plugins[name]`. Note the difference between `server.settings.app` which is used to store configuration value
  and `server.app` which is meant for storing run-time state.

- <a name="server.config.cache"></a>`cache` - sets up server-side caching. Every server includes a default cache for storing
  application state. By default, a simple memory-based cache is created which has limited capacity and capabilities. **hapi**
  uses [**catbox**](https://github.com/hapijs/catbox) for its cache which includes support for Redis, MongoDB, Memcached, and
  Riak. Caching is only utilized if methods and plugins explicitly store their state in the cache. The server cache
  configuration only defines the storage container itself. `cache` can be assigned:
    - a prototype function (usually obtained by calling `require()` on a **catbox** strategy such as `require('catbox-redis')`).
    - a configuration object with the following options:
        - `engine` - a prototype function or **catbox** engine object.
        - `name` - an identifier used later when provisioning or configuring caching for routes, methods, or plugins. Each
          connection name must be unique. A single item may omit the `name` option which defines the default cache. If every
          connection includes a `name`, a default memory cache is provisions as well as the default.
        - `shared` - if `true`, allows multiple cache users to share the same segment (e.g. multiple servers in a pack using
          the same route and cache. Default to not shared.
        - other options required by the **catbox** strategy used.
    - an array of the above object for configuring multiple cache instances, each with a unique name. When an array of objects
      is provided, multiple cache connections are established and each array item (except one) must include a `name`.

- `cors` - the [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows browsers to make cross-origin API
  calls. CORS is required by web applications running inside a browser which are loaded from a different domain than the API
  server. CORS headers are disabled by default. To enable, set `cors` to `true`, or to an object with the following options:
    - `origin` - a strings array of allowed origin servers ('Access-Control-Allow-Origin'). The array can contain any combination of fully qualified origins
      along with origin strings containing a wilcard '*' character, or a single `'*'` origin string. Defaults to any origin `['*']`.
    - `isOriginExposed` - if `false`, prevents the server from returning the full list of non-wildcard `origin` values if the incoming origin header
      does not match any of the values. Has no impact if `matchOrigin` is set to `false`. Defaults to `true`.
    - `matchOrigin` - if `false`, returns the list of `origin` values without attempting to match the incoming origin value. Cannot be used with
      wildcard `origin` values. Defaults to `true`.
    - `maxAge` - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it
      will take before the browser checks for changes in policy. Defaults to `86400` (one day).
    - `headers` - a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to `['Authorization', 'Content-Type', 'If-None-Match']`.
    - `additionalHeaders` - a strings array of additional headers to `headers`. Use this to keep the default headers in place.
    - `methods` - a strings array of allowed HTTP methods ('Access-Control-Allow-Methods'). Defaults to `['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']`.
    - `additionalMethods` - a strings array of additional methods to `methods`. Use this to keep the default methods in place.
    - `exposedHeaders` - a strings array of exposed headers ('Access-Control-Expose-Headers'). Defaults to `['WWW-Authenticate', 'Server-Authorization']`.
    - `additionalExposedHeaders` - a strings array of additional headers to `exposedHeaders`. Use this to keep the default headers in place.
    - `credentials` - if `true`, allows user credentials to be sent ('Access-Control-Allow-Credentials'). Defaults to `false`.

- `security` - sets some common security related headers. All headers are disabled by default. To enable set `security` to `true` or to an object with
  the following options:
    - `hsts` - controls the 'Strict-Transport-Security' header. If set to `true` the header will be set to `max-age=15768000`, if specified as a number
      the maxAge parameter will be set to that number. Defaults to `true`. You may also specify an object with the following fields:
        - `maxAge` - the max-age portion of the header, as a number. Default is `15768000`.
        - `includeSubdomains` - a boolean specifying whether to add the `includeSubdomains` flag to the header.
    - `xframe` - controls the 'X-Frame-Options' header. When set to `true` the header will be set to `DENY`, you may also specify a string value of
      'deny' or 'sameorigin'. To use the 'allow-from' rule, you must set this to an object with the following fields:
        - `rule` - either 'deny', 'sameorigin', or 'allow-from'
        - `source` - when `rule` is 'allow-from' this is used to form the rest of the header, otherwise this field is ignored. If `rule` is 'allow-from'
          but `source` is unset, the rule will be automatically changed to 'sameorigin'.
    - `xss` - boolean that controls the 'X-XSS-PROTECTION' header for IE. Defaults to `true` which sets the header to equal '1; mode=block'. NOTE: This setting can create a security vulnerability in versions of IE below 8, as well as unpatched versions of IE8. See [here](http://hackademix.net/2009/11/21/ies-xss-filter-creates-xss-vulnerabilities/) and [here](https://technet.microsoft.com/library/security/ms10-002) for more information. If you actively support old versions of IE, it may be wise to explicitly set this flag to `false`.
    - `noOpen` - boolean controlling the 'X-Download-Options' header for IE, preventing downloads from executing in your context. Defaults to `true` setting
      the header to 'noopen'.
    - `noSniff` - boolean controlling the 'X-Content-Type-Options' header. Defaults to `true` setting the header to its only and default option, 'nosniff'.

- `debug` - controls the error types sent to the console:
    - `request` - a string array of request log tags to be displayed via `console.error()` when the events are logged via `request.log()`. Defaults
      to uncaught errors thrown in external code (these errors are handled automatically and result in an Internal Server Error (500) error response) or
      runtime errors due to incorrect implementation of the hapi API. For example, to display all errors, change the option to `['error']`.
      To turn off all console debug messages set it to `false`.

- <a name="server.config.files"></a>`files` - defines the behavior for serving static resources using the built-in route handlers for files and directories:
    - `relativeTo` - determines the folder relative paths are resolved against when using the file and directory handlers.
    - `etagsCacheMaxSize` - sets the maximum number of file etag hash values stored in the cache. Defaults to `10000`.

- `json` - optional arguments passed to `JSON.stringify()` when converting an object or error response to a string payload. Supports the following:
    - `replacer` - the replacer function or array. Defaults to no action.
    - `space` - number of spaces to indent nested object keys. Defaults to no indentation.

- `labels` - a string array of labels used when registering plugins to [`plugin.select()`](#pluginselectlabels) matching server labels. Defaults
  to an empty array `[]` (no labels).

- `load` - server load monitoring and limits configuration (stored under `server.load` when enabled) where:
    - `maxHeapUsedBytes` - maximum V8 heap size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).
    - `maxRssBytes` - maximum process RSS size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).
    - `maxEventLoopDelay` - maximum event loop delay duration in milliseconds over which incoming requests are rejected with an HTTP Server Timeout (503) response.
      Defaults to `0` (no limit).
    - `sampleInterval` - the frequency of sampling in milliseconds. Defaults to `0` (no sampling).

- <a name="server.config.location"></a>`location` - used to convert relative 'Location' header URIs to absolute, by adding this value as prefix. Value must not contain a trailing `'/'`.
  Defaults to the host received in the request HTTP 'Host' header and if missing, to `server.info.uri`.

- `cacheControlStatus` - an array of HTTP response status codes (e.g. `200`) which are allowed to include a valid caching directive. Defaults to `[200]`.

- <a name="server.config.payload"></a>`payload` - controls how incoming payloads (request body) are processed:
    - `maxBytes` - limits the size of incoming payloads to the specified byte count. Allowing very large payloads may cause the server to run
      out of memory. Defaults to `1048576` (1MB).
    - `uploads` - the directory used for writing file uploads. Defaults to `os.tmpDir()`.

- `plugins` - plugin-specific configuration which can later be accessed by `server.plugins`. Provides a place to store and pass plugin configuration that
  is at server-level. The `plugins` is an object where each key is a plugin name and the value is the configuration. Note the difference between
  `server.settings.plugins` which is used to store configuration value and `server.plugins` which is meant for storing run-time state.

- <a name="server.config.router"></a>`router` - controls how incoming request URIs are matched against the routing table:
    - `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to `true`.
    - `stripTrailingSlash` - removes trailing slashes on incoming paths. Defaults to `false`.

- <a name="server.config.state"></a>`state` - HTTP state management (cookies) allows the server to store information on the client which is sent back to
  the server with every request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)).
    - `cookies` - The server automatically parses incoming cookies based on these options:
        - `parse` - determines if incoming 'Cookie' headers are parsed and stored in the `request.state` object. Defaults to `true`.
        - `failAction` - determines how to handle cookie parsing errors. Allowed values are:
            - `'error'` - return a Bad Request (400) error response. This is the default value.
            - `'log'` - report the error but continue processing the request.
            - `'ignore'` - take no action.
        - `clearInvalid` - if `true`, automatically instruct the client to remove invalid cookies. Defaults to `false`.
        - `strictHeader` - if `false`, allows any cookie value including values in violation of [RFC 6265](https://tools.ietf.org/html/rfc6265). Defaults to `true`.

- `timeout` - define timeouts for processing durations:
    - `server` - response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an incoming client request before giving
      up and responding with a Service Unavailable (503) error response. Disabled by default (`false`).
    - `client` - request timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body) before giving up
      and responding with a Request Timeout (408) error response. Set to `false` to disable. Can be customized on a per-route basis using the route
      `payload.timeout` configuration. Defaults to `10000` (10 seconds).
    - `socket` - by default, node sockets automatically timeout after 2 minutes. Use this option to override this behavior. Defaults to `undefined`
      which leaves the node default unchanged. Set to `false` to disable socket timeouts.

- `tls` - used to create an HTTPS server. The `tls` object is passed unchanged as options to the node.js HTTPS server as described in the
  [node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

- `maxSockets` - sets the number of sockets available per outgoing proxy host connection. `false` means use the [wreck](https://www.npmjs.org/package/wreck) default value (`Infinity`).
    Does not affect non-proxy outgoing client connections. Defaults to `Infinity`.

- `validation` - options to pass to [Joi](http://github.com/hapijs/joi). Useful to set global options such as `stripUnknown` or `abortEarly`
  (the complete list is available [here](https://github.com/hapijs/joi#validatevalue-schema-options-callback)). Defaults to no options.

### `Server` properties

Each instance of the `Server` object have the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `methods` - methods registered with [`server.method()`](#servermethodname-fn-options).
- `info` - server information:
    - `port` - the port the server was configured to (before `start()`) or bound to (after `start()`).
    - `host` - the hostname the server was configured to (defaults to `'0.0.0.0'` if no host was provided).
    - `protocol` - the protocol used (e.g. `'http'` or `'https'`).
    - `uri` - a string with the following format: 'protocol://host:port' (e.g. 'http://example.com:8080').
- `listener` - the node HTTP server object.
- `load` - server load metrics (when `server.load.sampleInterval` is enabled):
    - `eventLoopDelay` - event loop delay milliseconds.
    - `heapUsed` - V8 heap usage.
    - `rss` - RSS memory usage.
- `pack` - the [`Pack`](#hapipack) object the server belongs to (automatically assigned when creating a server instance directly).
- `plugins` - an object where each key is a plugin name and the value are the exposed properties by that plugin using [`plugin.expose()`](#pluginexposekey-value).
- `settings` - an object containing the [server options](#server-options) after applying the defaults.

### `Server` methods

#### `server.start([callback])`

Starts the server by listening for incoming connections on the configured port. If provided, `callback()` is called once the server is
ready for new connections. If the server is already started, the `callback()` is called on the next tick.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();
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

Adds a new route to the server where:

- `options` - the route configuration as described in [route options](#route-options).

##### Route options

The following options are available when adding a route:

- `path` - (required) the absolute path used to match incoming requests (must begin with '/'). Incoming requests are compared to the configured
  paths based on the server [`router`](#server.config.router) configuration option. The path can include named parameters enclosed in `{}` which
  will be matched against literal values in the request as described in [Path parameters](#path-parameters).

- `method` - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'.
  Use `'*'` to match against any HTTP method (only when an exact match was not found, and any match with a specific method will be given a higher
  priority over a wildcard match). Can be assigned an array of methods which has the same result as adding the same route with different methods manually.

- `vhost` - an optional domain string or an array of domain strings for limiting the route to only requests with a matching host header field.
  Matching is done against the hostname part of the header only (excluding the port). Defaults to all hosts.

- `handler` - (required) the function called to generate the response after successful authentication and validation. The handler function is
  described in [Route handler](#route-handler). If set to a string, the value is parsed the same way a prerequisite server method string shortcut is processed. Alternatively, `handler` can be assigned an object with one of:
    - <a name="route.config.file"></a>`file` - generates a static file endpoint for serving a single file. `file` can be set to:
        - a relative or absolute file path string (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
        - a function with the signature `function(request)` which returns the relative or absolute file path.
        - an object with the following options:
            - `path` - a path string or function as described above.
            - `filename` - an optional filename to specify if sending a 'Content-Disposition' header, defaults to the basename of `path`
            - `mode` - specifies whether to include the 'Content-Disposition' header with the response. Available values:
                - `false` - header is not included. This is the default value.
                - `'attachment'`
                - `'inline'`
            - `lookupCompressed` - if `true`, looks for the same filename with the '.gz' suffix for a precompressed version of the file to
              serve if the request supports content encoding. Defaults to `false`.

    - <a name="route.config.directory"></a>`directory` - generates a directory endpoint for serving static content from a directory. Routes using the
      directory handler must include a path parameter at the end of the path string (e.g. `/path/to/somewhere/{param}` where the parameter name does
      not matter). The path parameter can use any of the parameter options (e.g. `{param}` for one level files only, `{param?}` for one level files or
      the directory root, `{param*}` for any level, or `{param*3}` for a specific level). If additional path parameters are present, they are ignored for
      the purpose of selecting the file system resource. The directory handler is an object with the following options:
        - `path` - (required) the directory root path (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
          Value can be:
            - a single path string used as the prefix for any resources requested by appending the request path parameter to the provided string.
            - an array of path strings. Each path will be attempted in order until a match is found (by following the same process as the single path string).
            - a function with the signature `function(request)` which returns the path string or an array of path strings. If the function returns an
              error, the error is passed back to the client in the response.
        - `index` - optional boolean, determines if 'index.html' will be served if found in the folder when requesting a directory. Defaults to `true`.
        - `listing` - optional boolean, determines if directory listing is generated when a directory is requested without an index document.
          Defaults to `false`.
        - `showHidden` - optional boolean, determines if hidden files will be shown and served. Defaults to `false`.
        - `redirectToSlash` - optional boolean, determines if requests for a directory without a trailing slash are redirected to the same path with
          the missing slash. Useful for ensuring relative links inside the response are resolved correctly. Disabled when the server config
          `router.stripTrailingSlash` is `true. `Defaults to `true`.
        - `lookupCompressed` - optional boolean, instructs the file processor to look for the same filename with the '.gz' suffix for a precompressed
          version of the file to serve if the request supports content encoding. Defaults to `false`.
        - `defaultExtension` - optional string, appended to file requests if the requested file is not found. Defaults to no extension.

    - <a name="route.config.proxy"></a>`proxy` - generates a reverse proxy handler with the following options:
        - `host` - the upstream service host to proxy requests to.  The same path on the client request will be used as the path on the host.
        - `port` - the upstream service port.
        - `protocol` - The protocol to use when making a request to the proxied host:
            - `'http'`
            - `'https'`
        - `uri` - an absolute URI used instead of the incoming host, port, protocol, path, and query. Cannot be used with `host`, `port`, `protocol`, or `mapUri`.
        - `passThrough` - if `true`, forwards the headers sent from the client to the upstream service being proxied to, headers sent from the upstream service will also be forwarded to the client. Defaults to `false`.
        - `localStatePassThrough` - if `false`, any locally defined state is removed from incoming requests before being passed upstream. This is
          a security feature to prevent local state (e.g. authentication cookies) from leaking upstream to other servers along with the cookies intended
          for those servers. This value can be overridden on a per state basis via the [`server.state()`](#serverstatename-options) `passThrough` option.
          Defaults to `false`.
        - `acceptEncoding` - if `false`, does not pass-through the 'Accept-Encoding' HTTP header which is useful when using an `onResponse` post-processing
          to avoid receiving an encoded response (e.g. gzipped). Can only be used together with `passThrough`. Defaults to `true` (passing header).
        - `rejectUnauthorized` - sets the `rejectUnauthorized` property on the https [agent](http://nodejs.org/api/https.html#https_https_request_options_callback)
          making the request. This value is only used when the proxied server uses TLS/SSL.  When set it will override the node.js `rejectUnauthorized` property.
          If `false` then ssl errors will be ignored. When `true` the server certificate is verified and an 500 response will be sent when verification fails.  This
          shouldn't be used alongside the `agent` setting as the `agent` will be used instead.
          Defaults to the https agent default value of `true`.
        - `xforward` - if `true`, sets the 'X-Forwarded-For', 'X-Forwarded-Port', 'X-Forwarded-Proto' headers when making a request to the
          proxied upstream endpoint. Defaults to `false`.
        - `redirects` - the maximum number of HTTP redirections allowed, to be followed automatically by the handler. Set to `false` or `0` to
          disable all redirections (the response will contain the redirection received from the upstream service). If redirections are enabled,
          no redirections (301, 302, 307, 308) will be passed along to the client, and reaching the maximum allowed redirections will return an
          error response. Defaults to `false`.
        - `timeout` - number of milliseconds before aborting the upstream request. Defaults to `180000` (3 minutes).
        - `mapUri` - a function used to map the request URI to the proxied URI. Cannot be used together with `host`, `port`, `protocol`, or `uri`.
          The function signature is `function(request, callback)` where:
            - `request` - is the incoming `request` object
            - `callback` - is `function(err, uri, headers)` where:
                - `err` - internal error condition.
                - `uri` - the absolute proxy URI.
                - `headers` - optional object where each key is an HTTP request header and the value is the header content.
        - `onResponse` - a custom function for processing the response from the upstream service before sending to the client. Useful for
          custom error handling of responses from the proxied endpoint or other payload manipulation. Function signature is
          `function(err, res, request, reply, settings, ttl)` where:
              - `err` - internal or upstream error returned from attempting to contact the upstream proxy.
              - `res` - the node response object received from the upstream service. `res` is a readable stream (use the
                [**wreck**](https://github.com/hapijs/wreck) module `read` method to easily convert it to a Buffer or string).
              - `request` - is the incoming `request` object.
              - `reply()` - the continuation function.
              - `settings` - the proxy handler configuration.
              - `ttl` - the upstream TTL in milliseconds if `proxy.ttl` it set to `'upstream'` and the upstream response included a valid
                'Cache-Control' header with 'max-age'.
        - `ttl` - if set to `'upstream'`, applies the upstream response caching policy to the response using the `response.ttl()` method (or passed
          as an argument to the `onResponse` method if provided).
        - `agent` - a node [http(s) agent](http://nodejs.org/api/http.html#http_class_http_agent) to be used for connections to upstream server.

    - <a name="route.config.view"></a>`view` - generates a template-based response. The `view` option can be set to one of:
        - a string with the template file name.
        - an object with the following keys:
            - `template` - a string with the template file name.
            - `context` - an optional template context object. Defaults to an object with the following key:
                - `payload` - maps to `request.payload`.
                - `params` - maps to `request.params`.
                - `query` - maps to `request.query`.
                - `pre` - maps to `request.pre`.
            - `options` - optional object used to override the server's [`views`](#serverviewsoptions) configuration.

- `config` - additional route configuration (the `config` options allows splitting the route information from its implementation):
    - `handler` - an alternative location for the route handler function. Same as the `handler` option in the parent level. Can only
      include one handler per route.
    - `bind` - an object passed back to the provided handler (via `this`) when called.
    - `app` - application-specific configuration. Provides a safe place to pass application configuration without potential conflicts
      with **hapi**. Should not be used by plugins which should use `plugins[name]`.
    - `plugins` - plugin-specific configuration. Provides a place to pass route-level plugin configuration. The `plugins` is an object
      where each key is a plugin name and the value is the state.
    - `pre` - an array with prerequisites methods which are executed in serial or in parallel before the handler is called and are
      described in [Route prerequisites](#route-prerequisites).

    - `validate` - request input validation rules for various request components. When using a [Joi](http://github.com/hapijs/joi)
      validation object, the values of the other inputs (e.g. `headers`, `query`, and `params` when validating `payload`) are made
      available under the validation context (accessible in rules as `Joi.ref('$query.key')`). Note that validation is performed in
      order (i.e. headers, params, query, payload) and if type casting is used (converting a string to number), the value of inputs
      not yet validated will reflect the raw, unvalidated and unmodified values. The `validate` object supports:

        - `headers` - validation rules for incoming request headers. Values allowed:
            - `true` - any headers allowed (no validation performed).  This is the default.
            - `false` - no headers allowed (this will cause all valid HTTP requests to fail).
            - a [Joi](http://github.com/hapijs/joi) validation object.
            - a validation function using the signature `function(value, options, next)` where:
                - `value` - the object containing the request headers.
                - `options` - the server validation options.
                - `next(err, value)` - the callback function called when validation is completed.

        - `params` - validation rules for incoming request path parameters, after matching the path against the route and extracting any
          parameters then stored in `request.params`. Values allowed:
            - `true` - any path parameters allowed (no validation performed).  This is the default.
            - `false` - no path variables allowed.
            - a [Joi](http://github.com/hapijs/joi) validation object.
            - a validation function using the signature `function(value, options, next)` where:
                - `value` - the object containing the path parameters.
                - `options` - the server validation options.
                - `next(err, value)` - the callback function called when validation is completed.

        - `query` - validation rules for an incoming request URI query component (the key-value part of the URI between '?' and '#').
          The query is parsed into its individual key-value pairs (see
          [Query String](http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)) and stored in
          `request.query` prior to validation. Values allowed:
            - `true` - any query parameters allowed (no validation performed). This is the default.
            - `false` - no query parameters allowed.
            - a [Joi](http://github.com/hapijs/joi) validation object.
            - a validation function using the signature `function(value, options, next)` where:
                - `value` - the object containing the query parameters.
                - `options` - the server validation options.
                - `next(err, value)` - the callback function called when validation is completed.

        - `payload` - validation rules for an incoming request payload (request body). Values allowed:
            - `true` - any payload allowed (no validation performed). This is the default.
            - `false` - no payload allowed.
            - a [Joi](http://github.com/hapijs/joi) validation object.
            - a validation function using the signature `function(value, options, next)` where:
                - `value` - the object containing the payload object.
                - `options` - the server validation options.
                - `next(err, value)` - the callback function called when validation is completed.

        - `errorFields` - an optional object with error fields copied into every validation error response.
        - `failAction` - determines how to handle invalid requests. Allowed values are:
            - `'error'` - return a Bad Request (400) error response. This is the default value.
            - `'log'` - log the error but continue processing the request.
            - `'ignore'` - take no action.
            - a custom error handler function with the signature `function(source, error, next)` where:
                - `source` - the source of the invalid field (e.g. 'path', 'query', 'payload').
                - `error` - the error object prepared for the client response (including the validation function error under `error.data`).
                - `next` - the continuation method called to resume route processing or return an error response. The function signature
                  is `function(exit)` where:
                    - `exit` - optional client response. If set to a non-falsy value, the request lifecycle process will jump to the
                      "send response" step, skipping all other steps in between, and using the `exit` value as the new response. `exit` can
                      be any result value accepted by [`reply()`](#replyresult).

    - `payload` - determines how the request payload is processed:
        - `output` - the type of payload representation requested. The value must be one of:
            - `'data'` - the incoming payload is read fully into memory. If `parse` is `true`, the payload is parsed (JSON, form-decoded,
              multipart) based on the 'Content-Type' header. If `parse` is false, the raw `Buffer` is returned. This is the default value
              except when a proxy handler is used.
            - `'stream'` - the incoming payload is made available via a `Stream.Readable` interface. If the payload is 'multipart/form-data' and
              `parse` is `true`, fields values are presented as text while files are provided as streams. File streams from a
              'multipart/form-data' upload will also have a property `hapi` containing `filename` and `headers` properties.
            - `'file'` - the incoming payload in written to temporary file in the directory specified by the server's `payload.uploads` settings.
              If the payload is 'multipart/form-data' and `parse` is `true`, fields values are presented as text while files are saved. Note that
              it is the sole responsibility of the application to clean up the files generated by the framework. This can be done by keeping track
              of which files are used (e.g. using the `request.app` object), and listening to the server `'response'` event to perform any needed
              cleaup.
        - `parse` - can be `true`, `false`, or `gunzip`; determines if the incoming payload is processed or presented raw. `true` and `gunzip`
          includes gunzipping when the appropriate 'Content-Encoding' is specified on the received request. If parsing is enabled and the
          'Content-Type' is known (for the whole payload as well as parts), the payload is converted into an object when possible. If the
          format is unknown, a Bad Request (400) error response is sent. Defaults to `true`, except when a proxy handler is used. The
          supported mime types are:
            - 'application/json'
            - 'application/x-www-form-urlencoded'
            - 'application/octet-stream'
            - 'text/*'
            - 'multipart/form-data'
        - `allow` - a string or an array of strings with the allowed mime types for the endpoint. Defaults to any of the supported mime types listed
          above. Note that allowing other mime types not listed will not enable them to be parsed, and that if parsing mode is `'parse'`, the request
          will result in an error response.
        - `override` - a mime type string overriding the 'Content-Type' header value received. Defaults to no override.
        - `maxBytes` - overrides the server [default value](#server.config.payload) for this route.
        - `timeout` - payload processing timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body)
          before giving up and responding with a Request Timeout (408) error response. Set to `false` to disable. Defaults to the server `timeout.client`
          configuration.
        - `uploads` - overrides the server [default value](#server.config.payload) for this route.
        - `failAction` - determines how to handle payload parsing errors. Allowed values are:
            - `'error'` - return a Bad Request (400) error response. This is the default value.
            - `'log'` - report the error but continue processing the request.
            - `'ignore'` - take no action and continue processing the request.

    - `response` - validation rules for the outgoing response payload (response body). Can only validate [object](#obj) response:
        - `schema` - the response object validation rules expressed as one of:
            - `true` - any payload allowed (no validation performed). This is the default.
            - `false` - no payload allowed.
            - a [Joi](http://github.com/hapijs/joi) validation object.
            - a validation function using the signature `function(value, options, next)` where:
                - `value` - the object containing the response object.
                - `options` - the server validation options.
                - `next(err)` - the callback function called when validation is completed.
        - `sample` - the percent of responses validated (0 - 100). Set to `0` to disable all validation. Defaults to `100` (all responses).
        - `failAction` - defines what to do when a response fails validation. Options are:
            - `error` - return an Internal Server Error (500) error response. This is the default value.
            - `log` - log the error but send the response.

    - `cache` - if the route method is 'GET', the route can be configured to include caching directives in the response using the following options:
        - `privacy` - determines the privacy flag included in client-side caching using the 'Cache-Control' header. Values are:
            - `'default'` - no privacy flag. This is the default setting.
            - `'public'` - mark the response as suitable for public caching.
            - `'private'` - mark the response as suitable only for private caching.
        - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
          together with `expiresAt`.
        - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
          expire. Cannot be used together with `expiresIn`.

    - <a name="route.config.auth"></a>`auth` - authentication configuration. Value can be:
        - `false` to disable authentication if a default strategy is set.
        - a string with the name of an authentication strategy registered with `server.auth.strategy()`.
        - an object with:
            - `mode` - the authentication mode. Defaults to `'required'` if a server authentication strategy is configured, otherwise defaults
              to no authentication. Available values:
                - `'required'` - authentication is required.
                - `'optional'` - authentication is optional (must be valid if present).
                - `'try'` - same as `'optional'` but allows for invalid authentication.
            - `strategies` - a string array of strategy names in order they should be attempted. If only one strategy is used, `strategy` can
              be used instead with the single string value. Defaults to the default authentication strategy which is available only when a single
              strategy is configured.
            - `payload` - if set, the payload (in requests other than 'GET' and 'HEAD') is authenticated after it is processed. Requires a strategy
              with payload authentication support (e.g. [Hawk](#hawk-authentication)). Available values:
                - `false` - no payload authentication. This is the default value.
                - `'required'` - payload authentication required.
                - `'optional'` - payload authentication performed only when the client includes payload authentication information (e.g.
                  `hash` attribute in Hawk).
            - `scope` - the application scope required to access the route. Value can be a scope string or an array of scope strings. The authenticated
              credentials object `scope` property must contain at least one of the scopes defined to access the route. Defaults to no scope required.
            - `entity` - the required authenticated entity type. If set, must match the `entity` value of the authentication credentials. Available
              values:
                - `any` - the authentication can be on behalf of a user or application. This is the default value.
                - `user` - the authentication must be on behalf of a user.
                - `app` - the authentication must be on behalf of an application.

    - `cors` - when `false`, the server's CORS headers are disabled for the route. Defaults to using the server's settings.

    - `jsonp` - enables JSONP support by setting the value to the query parameter name containing the function name used to wrap the response payload.
      For example, if the value is `'callback'`, a request comes in with `'callback=me'`, and the JSON response is `'{ "a":"b" }'`, the payload will be:
      `'me({ "a":"b" });'`. Does not work with stream responses.

    - `files` - overrides the server settings controling the behavior for serving static resources using the built-in route handlers for files and
      directories:
        - `relativeTo` - determines the folder relative paths are resolved against when using the file and directory handlers.

    - `description` - route description used for generating documentation (string).
    - `notes` - route notes used for generating documentation (string or array of strings).
    - `tags` - route tags used for generating documentation (array of strings).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

// Handler in top level

var status = function (request, reply) {

    reply('ok');
};

server.route({ method: 'GET', path: '/status', handler: status });

// Handler in config

var user = {
    cache: { expiresIn: 5000 },
    handler: function (request, reply) {

        reply({ name: 'John' });
    }
};

server.route({ method: 'GET', path: '/user', config: user });
```

##### Path processing

The router iterates through the routing table on each incoming request and executes the first (and only the first) matching route. Route
matching is done on a combination of the request path and the HTTP verb. The query is excluded from the routing logic. Requests are matched in a deterministic order where the order in which routes are added does not matter. The routes are sorted from the most specific to the most generic. The specificity of a route is a combination of the HTTP verb and the route path. The more specific a route definition is, the higher up in the routing table it will appear. For example, the following path array shows the order in which an incoming request path will be matched against the routes:

```javascript
var paths = [
    '/',
    '/a',
    '/b',
    '/ab',
    '/a{p}b',
    '/a{p}',
    '/{p}b',
    '/{p}',
    '/a/b',
    '/a/{p}',
    '/b/',
    '/a1{p}/a',
    '/xx{p}/b',
    '/x{p}/a',
    '/x{p}/b',
    '/y{p}/b',
    '/{p}xx/b',
    '/{p}x/b',
    '/{p}y/b',
    '/a/b/c',
    '/a/b/{p}',
    '/a/d{p}c/b',
    '/a/d{p}/b',
    '/a/{p}d/b',
    '/a/{p}/b',
    '/a/{p}/c',
    '/a/{p*2}',
    '/a/b/c/d',
    '/a/b/{p*2}',
    '/a/{p}/b/{x}',
    '/{p*5}',
    '/a/b/{p*}',
    '/{a}/b/{p*}',
    '/{p*}'
];
```

##### Path parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming request path at that path segment. For example,
'/book/{id}/cover' will match '/book/123/cover' and `request.params.id` will be set to `'123'`. Each path segment (everything between the opening '/' and
 the closing '/' unless it is the end of the path) can only include one named parameter. A parameter can cover the entire segment ('/{param}') or
 part of the segment ('/file.{ext}').

 An optional '?' suffix following the parameter name indicates an optional parameter (only allowed if the parameter is at the ends of the path or
 only covers part of the segment as in '/a{param?}/b'). For example, the route '/book/{id?}' matches '/book/' with the value of `request.params.id` set
 to an empty string `''`.

```javascript
var getAlbum = function (request, reply) {

    reply('You asked for ' +
          (request.params.song ? request.params.song + ' from ' : '') +
          request.params.album);
};

server.route({
    path: '/{album}/{song?}',
    method: 'GET',
    handler: getAlbum
});
```

In addition to the optional `?` suffix, a parameter name can also specify the number of matching segments using the `*` suffix, followed by a number greater than 1. If the number of expected parts can be anything, then use `*` without a number (matching any number of segments can only be used in the
last path segment).

```javascript
var getPerson = function (request, reply) {

    var nameParts = request.params.name.split('/');
    reply({ first: nameParts[0], last: nameParts[1] });
};

server.route({
    path: '/person/{name*2}',   // Matches '/person/john/doe'
    method: 'GET',
    handler: getPerson
});
```

##### Route handler

When a route is matched against an incoming request, the route handler is called and passed a reference to the [request](#request-object) object.
The handler method must call [`reply()`](#replyresult) or one of its sub-methods to return control back to the router.

```javascript
var handler = function (request, reply) {

    reply('success');
};
```

##### Route prerequisites

It is often necessary to perform prerequisite actions before the handler is called (e.g. load required reference data from a database).
The route `pre` option allows defining such pre-handler methods. The methods are called in order. If the `pre` array contains another array,
those methods are called in parallel. `pre` can be assigned a mixed array of:
- arrays containing the elements listed below, which are executed in parallel.
- objects with:
    - `method` - the function to call (or short-hand method string as described below). the function signature is identical to a route handler
      as describer in [Route handler](#route-handler).
    - `assign` - key name to assign the result of the function to within `request.pre`.
    - `failAction` - determines how to handle errors returned by the method. Allowed values are:
        - `'error'` - returns the error response back to the client. This is the default value.
        - `'log'` - logs the error but continues processing the request. If `assign` is used, the error will be assigned.
        - `'ignore'` - takes no special action. If `assign` is used, the error will be assigned.
- functions - same as including an object with a single `method` key.
- strings - special short-hand notation for [registered server methods](#servermethodname-fn-options) using the format 'name(args)'
  (e.g. `'user(params.id)'`) where:
    - 'name' - the method name. The name is also used as the default value of `assign`.
    - 'args' - the method arguments (excluding `next`) where each argument is a property of `request`.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

var pre1 = function (request, reply) {

    reply('Hello');
};

var pre2 = function (request, reply) {

    reply('World');
};

var pre3 = function (request, reply) {

    reply(request.pre.m1 + ' ' + request.pre.m2);
};

server.route({
    method: 'GET',
    path: '/',
    config: {
        pre: [
            [
                // m1 and m2 executed in parallel
                { method: pre1, assign: 'm1' },
                { method: pre2, assign: 'm2' }
            ],
            { method: pre3, assign: 'm3' },
        ],
        handler: function (request, reply) {

            reply(request.pre.m3 + '\n');
        }
    }
});
```

##### Route not found

If the application needs to override the default Not Found (404) error response, it can add a catch-all route for a specific
method or all methods. Only one catch-all route can be defined per server instance.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

var handler = function (request, reply) {

    reply('The page was not found').code(404);
};

server.route({ method: '*', path: '/{p*}', handler: handler });
```

#### `server.route(routes)`

Same as [server.route(options)](#serverrouteoptions) where `routes` is an array of route options.

```javascript
server.route([
    { method: 'GET', path: '/status', handler: status },
    { method: 'GET', path: '/user', config: user }
]);
```

#### `server.table([host])`

Returns a copy of the routing table where:
- `host` - optional host to filter routes matching a specific virtual host. Defaults to all virtual hosts.

The return value is an array of routes where each route contains:
- `settings` - the route config with defaults applied.
- `method` - the HTTP method in lower case.
- `path` - the route path.

```javascript
var table = server.table()
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
            payload: { output: 'stream' },
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

server.log(['test', 'error'], 'Test event');
```

#### `server.state(name, [options])`

[HTTP state management](http://tools.ietf.org/html/rfc6265) uses client cookies to persist a state across multiple requests. Cookie definitions
can be registered with the server using the `server.state()` method, where:

- `name` - is the cookie name.
- `options` - are the optional cookie settings:
    - `ttl` - time-to-live in milliseconds. Defaults to `null` (session time-life - cookies are deleted when the browser is closed).
    - `isSecure` - sets the 'Secure' flag. Defaults to `false`.
    - `isHttpOnly` - sets the 'HttpOnly' flag. Defaults to `false`.
    - `path` - the path scope. Defaults to `null` (no path).
    - `domain` - the domain scope. Defaults to `null` (no domain).
    - `autoValue` - if present and the cookie was not received from the client or explicitly set by the route handler, the cookie is automatically
      added to the response with the provided value. The value can be a function with signature `function(request, next)` where:
        - `request` - the request object.
        - `next` - the continuation function using the `function(err, value)` signature.
    - `encoding` - encoding performs on the provided value before serialization. Options are:
        - `'none'` - no encoding. When used, the cookie value must be a string. This is the default value.
        - `'base64'` - string value is encoded using Base64.
        - `'base64json'` - object value is JSON-stringified than encoded using Base64.
        - `'form'` - object value is encoded using the _x-www-form-urlencoded_ method.
        - `'iron'` - Encrypts and sign the value using [**iron**](https://github.com/hueniverse/iron).
    - `sign` - an object used to calculate an HMAC for cookie integrity validation. This does not provide privacy, only a mean to verify that the cookie value
      was generated by the server. Redundant when `'iron'` encoding is used. Options are:
        - `integrity` - algorithm options. Defaults to [`require('iron').defaults.integrity`](https://github.com/hueniverse/iron#options).
        - `password` - password used for HMAC key generation.
    - `password` - password used for `'iron'` encoding.
    - `iron` - options for `'iron'` encoding. Defaults to [`require('iron').defaults`](https://github.com/hueniverse/iron#options).
    - `failAction` - overrides the default server `state.cookies.failAction` setting.
    - `clearInvalid` - overrides the default server `state.cookies.clearInvalid` setting.
    - `strictHeader` - overrides the default server `state.cookies.strictHeader` setting.
    - `passThrough` - overrides the default proxy `localStatePassThrough` setting.

```javascript
// Set cookie definition

server.state('session', {
    ttl: 24 * 60 * 60 * 1000,     // One day
    isSecure: true,
    path: '/',
    encoding: 'base64json'
});

// Set state in route handler

var handler = function (request, reply) {

    var session = request.state.session;
    if (!session) {
        session = { user: 'joe' };
    }

    session.last = Date.now();

    reply('Success').state('session', session);
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

Initializes the server views manager where:

- `options` - a configuration object with the following:
    - `engines` - (required) an object where each key is a file extension (e.g. 'html', 'hbr'), mapped to the npm module used for
      rendering the templates. Alternatively, the extension can be mapped to an object with the following options:
        - `module` - the npm module used for rendering the templates. The module object must contain:
            - `compile()` - the rendering function. The required function signature depends on the `compileMode` settings. If the `compileMode` is
              `'sync'`, the signature is `compile(template, options)`, the return value is a function with signature `function(context, options)`,
              and the method is allowed to throw errors. If the `compileMode` is `'async'`, the signature is `compile(template, options, callback)`
              where `callback` has the signature `function(err, compiled)` where `compiled` is a function with signature
              `function(context, options, callback)` and `callback` has the signature `function(err, rendered)`.
        - any of the `views` options listed below (except `defaultExtension`) to override the defaults for a specific engine.
    - `defaultExtension` - defines the default filename extension to append to template names when multiple engines are configured and not
      explicit extension is provided for a given template. No default value.
    - `path` - the root file path used to resolve and load the templates identified when calling `reply.view()`. Defaults to current working
      directory.
    - `partialsPath` - the root file path where partials are located. Partials are small segments of template code that can be nested and reused
      throughout other templates. Defaults to no partials support (empty path).
    - `helpersPath` - the directory path where helpers are located. Helpers are functions used within templates to perform transformations
      and other data manipulations using the template context or other inputs. Each '.js' file in the helpers directory is loaded and the file name
      is used as the helper name. The files must export a single method with the signature `function(context)` and return a string. Sub-folders are
      not supported and are ignored. Defaults to no helpers support (empty path). Note that jade does not support loading helpers this way.
    - `basePath` - a base path used as prefix for `path` and `partialsPath`. No default.
    - `layout` - if set to `true` or a layout filename, layout support is enabled. A layout is a single template file used as the parent template
      for other view templates in the same engine. If `true`, the layout template name must be 'layout.ext' where 'ext' is the engine's extension.
      Otherwise, the provided filename is suffixed with the engine's extension and loaded. Disable `layout` when using Jade as it will handle
      including any layout files independently. Defaults to `false`.
    - `layoutPath` - the root file path where layout templates are located (relative to `basePath` if present). Defaults to `path`.
    - `layoutKeyword` - the key used by the template engine to denote where primary template content should go. Defaults to `'content'`.
    - `encoding` - the text encoding used by the templates when reading the files and outputting the result. Defaults to `'utf8'`.
    - `isCached` - if set to `false`, templates will not be cached (thus will be read from file on every use). Defaults to `true`.
    - `allowAbsolutePaths` - if set to `true`, allows absolute template paths passed to `reply.view()`. Defaults to `false`.
    - `allowInsecureAccess` - if set to `true`, allows template paths passed to `reply.view()` to contain '../'. Defaults to `false`.
    - `compileOptions` - options object passed to the engine's compile function. Defaults to empty options `{}`.
    - `runtimeOptions` - options object passed to the returned function from the compile operation. Defaults to empty options `{}`.
    - `contentType` - the content type of the engine results. Defaults to `'text/html'`.
    - `compileMode` - specify whether the engine `compile()` method is `'sync'` or `'async'`. Defaults to `'sync'`.
    - `context` - a global context used with all templates. The global context option can be either an object or a function that takes no arguments and returns a context object. When rendering views, the global context will be merged with any context object specified on the handler or using `reply.view()`. When multiple context objects are used, values from the global context always have lowest precedence.


```javascript
server.views({
    engines: {
        html: require('handlebars'),
        jade: require('jade')
    },
    path: '/static/templates'
});
```

#### `server.cache(name, options)`

Provisions a server cache segment within the common caching facility where:

- `options` - cache configuration as described in [**catbox** module documentation](https://github.com/hapijs/catbox#policy):
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
      together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
      expire. Cannot be used together with `expiresIn`.
    - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`.
    - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
    - `generateTimeout` - number of milliseconds to wait before returning a timeout error when an item is not in the cache and the generate
      method is taking too long.
    - `cache` - the name of the cache connection configured in the ['server.cache` option](#server.config.cache). Defaults to the default cache.

```javascript
var cache = server.cache('countries', { expiresIn: 60 * 60 * 1000 });
```

#### `server.auth.scheme(name, scheme)`

Registers an authentication scheme where:

- `name` - the scheme name.
- `scheme` - the method implementing the scheme with signature `function(server, options)` where:
    - `server` - a reference to the server object the scheme is added to.
    - `options` - optional scheme settings used to instantiate a strategy.

The `scheme` method must return an object with the following keys:

- `authenticate(request, reply)` - required function called on each incoming request configured with the authentication scheme where:
    - `request` - the request object.
    - `reply(err, result)` - the interface the authentication method must call when done where:
        - `err` - if not `null`, indicates failed authentication.
        - `result` - an object containing:
            - `credentials` - the authenticated credentials. Required if `err` is `null`.
            - `artifacts` - optional authentication artifacts.
            - `log` - optional object used to customize the request authentication log which supports:
                - `data` - log data.
                - `tags` - additional tags.
- `payload(request, next)` - optional function called to authenticate the request payload where:
    - `request` - the request object.
    - `next(err)` - the continuation function the method must called when done where:
        - `err` - if `null`, payload successfully authenticated. If `false`, indicates that authentication could not be performed
          (e.g. missing payload hash). If set to any other value, it is used as an error response.
- `response(request, next)` - optional function called to decorate the response with authentication headers before the response
  headers or payload is written where:
    - `request` - the request object.
    - `next(err)` - the continuation function the method must called when done where:
        - `err` - if `null`, successfully applied. If set to any other value, it is used as an error response.

#### `server.auth.strategy(name, scheme, [mode], [options])`

Registers an authentication strategy where:

- `name` - the strategy name.
- `scheme` - the scheme name (must be previously registered using `server.auth.scheme()`).
- `mode` - if `true`, the scheme is automatically assigned as a required strategy to any route without an `auth` config. Can only be
  assigned to a single server strategy. Value must be `true` (which is the same as `'required'`) or a valid authentication mode
  (`'required'`, `'optional'`, `'try'`). Defaults to `false`.
- `options` - scheme options based on the scheme requirements.

#### `server.auth.default(options)`

Sets a default startegy which is applied to every route. The default does not apply when the route config specifies `auth` as `false`,
or has an authentication strategy configured. Otherwise, the route authentication config is applied to the defaults. Note that the default
only applies at time of route configuration, not at runtime. Calling `default()` after adding a route will have no impact on that route.
The function requires:
- `options` - a string with the default strategy name or an object with a specified strategy or strategies using the same format as the
  [route `auth` handler options](#route.config.auth).

#### `server.auth.test(strategy, request, next)`

Tests a request against an authentication strategy where:
- `strategy` - the strategy name registered with `server.auth.strategy()`.
- `request` - the request object. The request route authentication configuration is not used.
- `next` - the callback function with signature `function(err, credentials)` where:
    - `err` - the error if authentication failed.
    - `credentials` - the authentication credentials object if authentication was successful.

#### `server.ext(event, method, [options])`

Registers an extension function in one of the available [extension points](#request-lifecycle) where:

- `event` - the event name.
- `method` - a function or an array of functions to be executed at a specified point during request processing. The required extension function signature
  is `function(request, next)` where:
    - `request` - the incoming `request` object.
    - `next` - the callback function the extension method must call to return control over to the router with signature `function(exit)` where:
        - `exit` - optional request processing exit response. If set to a non-falsy value, the request lifecycle process will jump to the
          "send response" step, skipping all other steps in between, and using the `exit` value as the new response. `exit` can be any result
          value accepted by [`reply()`](#replyresult).
    - `this` - the object provided via `options.bind`.
- `options` - an optional object with the following:
    - `before` - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed
      in the order added.
    - `after` - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed
      in the order added.
    - `bind` - any value passed back to the provided method (via `this`) when called.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onRequest', function (request, next) {

    // Change all requests to '/test'
    request.setUrl('/test');
    next();
});

var handler = function (request, reply) {

    reply({ status: 'ok' });
};

server.route({ method: 'GET', path: '/test', handler: handler });
server.start();

// All requests will get routed to '/test'
```

##### Request lifecycle

Each incoming request passes through a pre-defined set of steps, along with optional extensions:

- **`'onRequest'`** extension point
    - always called
    - the `request` object passed to the extension functions is decorated with the `request.setUrl(url)` and `request.setMethod(verb)` methods. Calls to these methods
      will impact how the request is routed and can be used for rewrite rules.
    - `request.route` is not yet populated as the router only looks at the request after this point.
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
    - The response object contained in `request.response` may be modified (but not assigned a new value). To return a different response type
      (for example, replace an error with an HTML response), return a new response via `next(response)`.
- Validate response payload
- **`'onPreResponse'`** extension point
    - always called.
    - The response contained in `request.response` may be modified (but not assigned a new value). To return a different response type (for
      example, replace an error with an HTML response), return a new response via `next(response)`. Note that any errors generated after
      `next(response)` is called will not be passed back to the `'onPreResponse'` extension method to prevent an infinite loop.
- Send response (may emit `'internalError'` event)
- Emits `'response'` event
- Wait for tails
- Emits `'tail'` event

#### `server.method(name, fn, [options])`

Registers a server method function. Server methods are functions registered with the server and used throughout the application as
a common utility. Their advantage is in the ability to configure them to use the built-in cache and shared across multiple request
handlers without having to create a common module.

Methods are registered via `server.method(name, fn, [options])` where:

- `name` - a unique method name used to invoke the method via `server.methods[name]`. When configured with caching enabled,
  `server.methods[name].cache.drop(arg1, arg2, ..., argn, callback)` can be used to clear the cache for a given key. Supports using
  nested names such as `utils.users.get` which will automatically create the missing path under `server.methods` and can be accessed
  for the previous example via `server.methods.utils.users.get`.
- `fn` - the method function with the signature is `function(arg1, arg2, ..., argn, next)` where:
    - `arg1`, `arg2`, etc. - the method function arguments.
    - `next` - the function called when the method is done with the signature `function(err, result, ttl)` where:
        - `err` - error response if the method failed.
        - `result` - the return value.
        - `ttl` - `0` if result is valid but cannot be cached. Defaults to cache policy.
- `options` - optional configuration:
    - `bind` - an object passed back to the provided method function (via `this`) when called. Defaults to `null` unless added via a plugin, in which
      case it defaults to the plugin bind object.
    - `cache` - cache configuration as described in [**catbox** module documentation](https://github.com/hapijs/catbox#policy) with a few additions:
        - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
          together with `expiresAt`.
        - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
          expire. Cannot be used together with `expiresIn`.
        - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`.
        - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
        - `generateTimeout` - number of milliseconds to wait before returning a timeout error when an item is not in the cache and the generate
          method is taking too long.
        - `segment` - optional segment name, used to isolate cached items within the cache partition. Defaults to '#name' where 'name' is the
          method name. When setting segment manually, it must begin with '##'.
        - `cache` - the name of the cache connection configured in the ['server.cache` option](#server.config.cache). Defaults to the default cache.
    - `generateKey` - a function used to generate a unique key (for caching) from the arguments passed to the method function
     (with the exception of the last 'next' argument). The server will automatically generate a unique key if the function's
     arguments are all of types `'string'`, `'number'`, or `'boolean'`. However if the method uses other types of arguments, a
     key generation function must be provided which takes the same arguments as the function and returns a unique string (or
     `null` if no key can be generated). Note that when the `generateKey` method is invoked, the arguments list will include
     the `next` argument which must not be used in calculation of the key.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

// Simple arguments

var add = function (a, b, next) {

    next(null, a + b);
};

server.method('sum', add, { cache: { expiresIn: 2000 } });

server.methods.sum(4, 5, function (err, result) {

    console.log(result);
});

// Object argument

var addArray = function (array, next) {

    var sum = 0;
    array.forEach(function (item) {

        sum += item;
    });

    next(null, sum);
};

server.method('sumObj', addArray, {
    cache: { expiresIn: 2000 },
    generateKey: function (array) {

        return array.join(',');
    }
});

server.methods.sumObj([5, 6], function (err, result) {

    console.log(result);
});
```

#### `server.method(method)`

Registers a server method function as described in [`server.method()`](#servermethodname-fn-options) using a method object or an array
of objects where each has:
- `name` - the method name.
- `fn` - the method function.
- `options` - optional settings.

```javascript
var add = function (a, b, next) {

    next(null, a + b);
};

server.method({ name: 'sum', fn: add, options: { cache: { expiresIn: 2000 } } });

server.method([{ name: 'also', fn: add }]);
```

#### `server.inject(options, callback)`

Injects a request into the server simulating an incoming HTTP request without making an actual socket connection. Injection is useful for
testing purposes as well as for invoking routing logic internally without the overhead or limitations of the network stack. Utilizes the
[**shot**](https://github.com/hapijs/shot) module for performing injections, with some additional options and response properties:

- `options` - can be assign a string with the requested URI, or an object with:
    - `method` - the request HTTP method (e.g. `'POST'`). Defaults to `'GET'`.
    - `url` - the request URL. If the URI includes an authority (e.g. `'example.com:8080'`), it is used to automatically set an HTTP 'Host'
      header, unless one was specified in `headers`.
    - `headers` - an object with optional request headers where each key is the header name and the value is the header content. Defaults
      to no additions to the default Shot headers.
    - `payload` - an optional string or buffer containing the request payload (object must be manually converted to a string first).
      Defaults to no payload. Note that payload processing defaults to `'application/json'` if no 'Content-Type' header provided.
    - `credentials` - an optional credentials object containing authentication information. The `credentials` are used to bypass the default
      authentication strategies, and are validated directly as if they were received via an authentication scheme. Defaults to no credentials.
    - `simulate` - an object with options used to simulate client request stream conditions for testing:
        - `error` - if `true`, emits an `'error'` event after payload transmission (if any). Defaults to `false`.
        - `close` - if `true`, emits a `'close'` event after payload transmission (if any). Defaults to `false`.
        - `end` - if `false`, does not end the stream. Defaults to `true`.
- `callback` - the callback function with signature `function(res)` where:
    - `res` - the response object where:
        - `statusCode` - the HTTP status code.
        - `headers` - an object containing the headers set.
        - `payload` - the response payload string.
        - `rawPayload` - the raw response payload buffer.
        - `raw` - an object with the injection request and response objects:
            - `req` - the `request` object.
            - `res` - the response object.
        - `result` - the raw handler response (e.g. when not a stream) before it is serialized for transmission. If not available, set to
          `payload`. Useful for inspection and reuse of the internal objects returned (instead of parsing the response string).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

var get = function (request, reply) {

    reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: get });

server.inject('/', function (res) {

    console.log(res.result);
});
```

#### `server.handler(name, method)`

Registers a new handler type which can then be used in routes. Overriding the built in handler types (`directory`, `file`, `proxy`, and `view`),
or any previously registered types is not allowed.

- `name` - string name for the handler being registered.
- `method` - the function used to generate the route handler using the signature `function(route, options)` where:
    - `route` - the route configuration object.
    - `options` - the configuration object provided in the handler config.

The `method` function can have a `defaults` property of an object or function. If the property is set to an object, that object is used as
the default route config for routes using this handler. If the property is set to a function, the function uses the signature `function(method)`
and returns the route default configuration.

```javascript
var Hapi = require('hapi');
var server = Hapi.createServer('localhost', 8000);

// Defines new handler for routes on this server
server.handler('test', function (route, options) {

    return function (request, reply) {

        reply('new handler: ' + options.msg);
    }
});

server.route({
    method: 'GET',
    path: '/',
    handler: { test: { msg: 'test' } }
});

server.start();
```

#### `server.location(uri, [request])`

Converts the provided URI to an absolute URI using the server or request configuration where:
- `uri` - the relative URI.
- `request` - an optional request object for using the request host header if no server location has been configured.

```javascript
var Hapi = require('hapi');
var server = Hapi.createServer('localhost', 8000);

console.log(server.location('/relative'));
```

#### `server.render(template, context, [options], callback)`

Utilizes the server views engine configured to render a template where:
- `template` - the template filename and path, relative to the templates path configured via the server [`views.path`](#serverviewsoptions).
- `context` - optional object used by the template to render context-specific result. Defaults to no context `{}`.
- `options` - optional object used to override the server's [`views`](#serverviewsoptions) configuration.
- `callback` - the callback function with signature `function (err, rendered, config)` where:
    - `err` - the rendering error if any.
    - `rendered` - the result view string.
    - `config` - the configuration used to render the template.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();
server.views({
    engines: { html: require('handlebars') },
    path: __dirname + '/templates'
});

var context = {
    title: 'Views Example',
    message: 'Hello, World'
};

server.render('hello', context, function (err, rendered, config) {

    console.log(rendered);
});
```

### `Server` events

The server object inherits from `Events.EventEmitter` and emits the following events:

- `'log'` - events logged with [server.log()](#serverlogtags-data-timestamp).
- `'request'` - events generated by [request.log()](#requestlogtags-data-timestamp) or internally (multiple events per request).
- `'response'` - emitted after a response to a client request is sent back. Single event per request.
- `'tail'` - emitted when a request finished processing, including any registered [tails](#requesttailname). Single event per request.
- `'internalError'` - emitted whenever an Internal Server Error (500) error response is sent. Single event per request.

When provided (as listed below) the `event` object include:

- `timestamp` - the event timestamp.
- `request` - if the event relates to a request, the `request id`.
- `server` - if the event relates to a server, the `server.info.uri`.
- `tags` - an array of tags (e.g. `['error', 'http']`). Includes the `'hapi'` tag is the event was generated internally.
- `data` - optional event-specific information.

The `'log'` event includes the `event` object and a `tags` object (where each tag is a key with the value `true`):

```javascript
server.on('log', function (event, tags) {

    if (tags.error) {
        console.log('Server error: ' + (event.data || 'unspecified'));
    }
});
```

The `'request'` event includes the `request` object, the `event` object, and a `tags` object (where each tag is a key with the value `true`):

```javascript
server.on('request', function (request, event, tags) {

    if (tags.received) {
        console.log('New request: ' + event.id);
    }
});
```

The `'response'` and `'tail'` events include the `request` object:

```javascript
server.on('response', function (request) {

    console.log('Response sent for request: ' + request.id);
});
```

The `'internalError'` event includes the `request` object and the causing error `err` object:

```javascript
server.on('internalError', function (request, err) {

    console.log('Error response (500) sent for request: ' + request.id + ' because: ' + err.message);
});
```

## Request object

The `request` object is created internally for each incoming request. It is **not** the node `request` object received from the HTTP
server callback (which is available in `request.raw.req`). The `request` object methods and properties change through the
[request lifecycle](#request-lifecycle).

### `request` properties

Each request object has the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `auth` - authentication information:
    - `isAuthenticated` - `true` is the request has been successfully authenticated, otherwise `false`.
    - `credentials` - the `credential` object received during the authentication process. The presence of an object does not mean
      successful authentication.
    - `artifacts` - an artifact object received from the authentication strategy and used in authentication-related actions.
    - `mode` - the route authentication mode.
    - `error` - the authentication error is failed and mode set to `'try'`.
    - `session` - an object used by the [`'cookie'` authentication scheme](https://github.com/hapijs/hapi-auth-cookie).
- `domain` - the node domain object used to protect against exceptions thrown in extensions, handlers and prerequisites. Can be used to
  manually bind callback functions otherwise bound to other domains.
- `headers` - the raw request headers (references `request.raw.headers`).
- `id` - a unique request identifier.
- `info` - request information:
    - `received` - request reception timestamp.
    - `remoteAddress` - remote client IP address.
    - `remotePort` - remote client port.
    - `referrer` - content of the HTTP 'Referrer' (or 'Referer') header.
    - `host` - content of the HTTP 'Host' header (e.g. 'example.com:8080').
    - `hostname` - the hostname part of the 'Host' header (e.g. 'example.com').
- `method` - the request method in lower case (e.g. `'get'`, `'post'`).
- `mime` - the parsed content-type header. Only available when payload parsing enabled and no payload error occurred.
- `orig` - an object containing the values of `params`, `query`, and `payload` before any validation modifications made. Only set when
  input validation is performed.
- `params` - an object where each key is a path parameter name with matching value as described in [Path parameters](#path-parameters).
- `path` - the request URI's path component.
- `payload` - the request payload based on the route `payload.output` and `payload.parse` settings.
- `plugins` - plugin-specific state. Provides a place to store and pass request-level plugin data. The `plugins` is an object where each
  key is a plugin name and the value is the state.
- `pre` - an object where each key is the name assigned by a [route prerequisites](#route-prerequisites) function. The values are the raw values
  provided to the continuation function as argument. For the wrapped response object, use `responses`.
- `response` - the response object when set. The object can be modified but must not be assigned another object. To replace the response
  with another from within an extension point, use `next(response)` to override with a different response.
- `responses` - same as `pre` but represented as the response object created by the pre method.
- `query` - an object containing the query parameters.
- `raw` - an object containing the Node HTTP server objects. **Direct interaction with these raw objects is not recommended.**
    - `req` - the `request` object.
    - `res` - the response object.
- `route` - the route configuration object after defaults are applied.
- `server` - the server object.
- `session` - Special key reserved for plugins implementing session support. Plugins utilizing this key must check for `null` value
  to ensure there is no conflict with another similar plugin.
- `state` - an object containing parsed HTTP state information (cookies) where each key is the cookie name and value is the matching
  cookie content after processing using any registered cookie definition.
- `url` - the parsed request URI.

### `request` methods

#### `request.setUrl(url)`

_Available only in `'onRequest'` extension methods._

 Changes the request URI before the router begins processing the request where:

 - `url` - the new request path value.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onRequest', function (request, next) {

    // Change all requests to '/test'
    request.setUrl('/test');
    next();
});
```

#### `request.setMethod(method)`

_Available only in `'onRequest'` extension methods._

Changes the request method before the router begins processing the request where:

- `method` - is the request HTTP method (e.g. `'GET'`).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onRequest', function (request, next) {

    // Change all requests to 'GET'
    request.setMethod('GET');
    next();
});
```

#### `request.log(tags, [data, [timestamp]])`

_Always available._

Logs request-specific events. When called, the server emits a `'request'` event which can be used by other listeners or plugins. The
arguments are:

- `tags` - a string or an array of strings (e.g. `['error', 'database', 'read']`) used to identify the event. Tags are used instead of log levels
  and provide a much more expressive mechanism for describing and filtering events. Any logs generated by the server internally include the `'hapi'`
  tag along with event-specific information.
- `data` - an optional message string or object with the application data being logged.
- `timestamp` - an optional timestamp expressed in milliseconds. Defaults to `Date.now()` (now).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.on('request', function (request, event, tags) {

    if (tags.error) {
        console.log(event);
    }
});

var handler = function (request, reply) {

    request.log(['test', 'error'], 'Test event');
};
```

#### `request.getLog([tags])`

_Always available._

Returns an array containing the events matching any of the tags specified (logical OR) where:
- `tags` - is a single tag string or array of tag strings. If no `tags` specified, returns all events.

```javascript
request.getLog();
request.getLog('error');
request.getLog(['hapi', 'error']);
```

#### `request.tail([name])`

_Available until immediately after the `'response'` event is emitted._

Adds a request tail which has to complete before the request lifecycle is complete where:

- `name` - an optional tail name used for logging purposes.

Returns a tail function which must be called when the tail activity is completed.

Tails are actions performed throughout the request lifecycle, but which may end after a response is sent back to the client. For example, a
request may trigger a database update which should not delay sending back a response. However, it is still desirable to associate the activity
with the request when logging it (or an error associated with it).

When all tails completed, the server emits a `'tail'` event.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

var get = function (request, reply) {

    var dbTail = request.tail('write to database');

    db.save('key', 'value', function () {

        dbTail();
    });

    reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: get });

server.on('tail', function (request) {

    console.log('Request completed including db activity');
});
```

### Request events

The request object supports the following events:

- `'peek'` - emitted for each chunk of payload data read from the client connection. The event method signature is `function(chunk, encoding)`.
- `'finish'` - emitted when the request payload finished reading. The event method signature is `function ()`.
- `'disconnect'` - emitted when a request errors or aborts unexpectedly.

```javascript
var Crypto = require('crypto');
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onRequest', function (request, reply) {

    var hash = Crypto.createHash('sha1');
    request.on('peek', function (chunk) {

        hash.update(chunk);
    });

    request.once('finish', function () {

        console.log(hash.digest('hex'));
    });

    request.once('disconnect', function () {

        console.error('request aborted');
    });
});
```

## Reply interface

### Flow control

When calling `reply()`, the router waits until `process.nextTick()` to continue processing the request and transmit the response.
This enables making changes to the returned response object before the response is sent. This means the router will resume as soon as the handler
method exits. To suspend this behavior, the returned `response` object includes:

- `response.hold()` - puts the response on hold until `response.send()` is called. Available only after `reply()` is called and until
  `response.hold()` is invoked once.
- `response.send()` - resume the response which will be transmitted in the next tick. Available only after `response.hold()` is called and until
  `response.send()` is invoked once.

```javascript
var handler = function (request, reply) {

    var response = reply('success').hold();

    setTimeout(function () {

        response.send();
    }, 1000);
};
```

When calling `reply()` in a prerequisite, it is sometimes necessary to take over the handler execution and return a non-error response back
to the client. The response object provides the `takeover()` method to indicate the value provided via `reply()` should be used as the final
response and skip any other prerequisites and the handler.

```javascript
var pre = function (request, reply) {

    if (!request.auth.isAuthenticated) {
        return reply('You need to login first!').takeover();
    }

    reply({ account: request.auth.credentials });   // Used in the handler later
};
```

### `reply([result])`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Concludes the handler activity by returning control over to the router where:

- `result` - an optional response payload.

Returns a [`response`](#response-object) object based on the value of `result`:

- `null`, `undefined`, or empty string `''` - [`Empty`](#empty) response.
- string - [`Text`](#text) response.
- `Buffer` object - [`Buffer`](#buffer) response.
- `Error` object (generated via [`error`](#hapierror) or `new Error()`) - [`Boom`](#hapierror) object.
- `Stream` object - [`Stream`](#stream) response.
- any other object - [`Obj`](#obj) response.

```javascript
var handler = function (request, reply) {

    reply('success');
};
```

The returned `response` object provides a set of methods to customize the response (e.g. HTTP status code, custom headers, etc.). The methods
are response-type-specific and listed in [`response`](#response-object).

The [response flow control rules](#flow-control) apply.

```javascript
var handler = function (request, reply) {

    reply('success')
        .type('text/plain')
        .header('X-Custom', 'some-value');
};
```

Note that if `result` is a `Stream` with a `statusCode` property, that status code will be used as the default response code.

### `reply.file(path, [options])`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Transmits a file from the file system. The 'Content-Type' header defaults to the matching mime type based on filename extension.:

- `path` - the file path.
- `options` - optional settings:
    - `filename` - an optional filename to specify if sending a 'Content-Disposition' header, defaults to the basename of `path`
    - `mode` - specifies whether to include the 'Content-Disposition' header with the response. Available values:
        - `false` - header is not included. This is the default value.
        - `'attachment'`
        - `'inline'`
    - `lookupCompressed` - if `true`, looks for the same filename with the '.gz' suffix for a precompressed version of the file to serve if the request supports content encoding. Defaults to `false`.

No return value.

The [response flow control rules](#flow-control) **do not** apply.

```javascript
var handler = function (request, reply) {

    reply.file('./hello.txt');
};
```

### `reply.view(template, [context, [options]])`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Concludes the handler activity by returning control over to the router with a templatized view response where:

- `template` - the template filename and path, relative to the templates path configured via the server [`views.path`](#serverviewsoptions).
- `context` - optional object used by the template to render context-specific result. Defaults to no context `{}`.
- `options` - optional object used to override the server's [`views`](#serverviewsoptions) configuration for this response. Cannot override
  `isCached`, `partialsPath`, or `helpersPath` which are only loaded at initialization.

Returns a response object.

The [response flow control rules](#flow-control) apply.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();
server.views({
    engines: { html: require('handlebars') },
    path: __dirname + '/templates'
});

var handler = function (request, reply) {

    var context = {
        title: 'Views Example',
        message: 'Hello, World'
    };

    reply.view('hello', context);
};

server.route({ method: 'GET', path: '/', handler: handler });
```

**templates/hello.html**

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

### `reply.close([options])`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Concludes the handler activity by returning control over to the router and informing the router that a response has already been sent back
directly via `request.raw.res` and that no further response action is needed. Supports the following optional options:
- `end` - if `false`, the router will not call `request.raw.res.end())` to ensure the response was ended. Defaults to `true`.

No return value.

The [response flow control rules](#flow-control) **do not** apply.

### `reply.proxy(options)`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Proxies the request to an upstream endpoint where:
- `options` - an object including the same keys and restrictions defined by the [route `proxy` handler options](#route.config.proxy).

No return value.

The [response flow control rules](#flow-control) **do not** apply.

```javascript
var handler = function (request, reply) {

    reply.proxy({ host: 'example.com', port: 80, protocol: 'http' });
};
```

### `reply.redirect(location)`

_Available only within the handler method and only before one of `reply()`, `reply.file()`, `reply.view()`,
`reply.close()`, `reply.proxy()`, or `reply.redirect()` is called._

Redirects the client to the specified location. Same as calling `reply().redirect(location)`.

Returns a response object.

The [response flow control rules](#flow-control) apply.

```javascript
var handler = function (request, reply) {

    reply.redirect('http://example.com');
};
```

Changing to a permanent or non-rewriterable redirect is also available see [response object redirect](#response-object-redirect) for more information.

## Response object

Every response includes the following properties:
- `statusCode` - the HTTP response status code. Defaults to `200` (except for errors).
- `headers` - an object containing the response headers where each key is a header field name. Note that this is an incomplete list of
  headers to be included with the response. Additional headers will be added once the response is prepare for transmission (e.g. 'Location',
  'Cache-Control').
- `source` - the value provided using the `reply()` interface.
- `variety` - a string indicating the type of `source` with available values:
    - `'plain'` - a plain response such as string, number, `null`, or simple object (e.g. not a `Stream`, `Buffer`, or view).
    - `'buffer'` - a `Buffer`.
    - `'view'` - a view generated with `reply.view()`.
    - `'file'` - a file generated with `reply.file()` of via the directory handler.
    - `'stream'` - a `Stream`.
- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `plugins` - plugin-specific state. Provides a place to store and pass request-level plugin data. The `plugins` is an object where each
  key is a plugin name and the value is the state.
- `settings` - response handling flags:
    - `charset` -  the 'Content-Type' HTTP header 'charset' property. Defaults to `'utf-8'`.
    - `encoding` - the string encoding scheme used to serial data into the HTTP payload when `source` is a string or marshalls into a string.
      Defaults to `'utf8'`.
    - `location` - the raw value used to set the HTTP 'Location' header (actual value set depends on the server
      [`location`](#server.config.location) configuration option). Defaults to no header.
    - `passThrough` - if `true` and `source` is a `Stream`, copies the `statusCode` and `headers` of the stream to the outbound response.
      Defaults to `true`.
    - `stringify` - options used for `source` value requiring stringification. Defaults to no replacer and no space padding.
    - `ttl` -  if set, overrides the route cache expiration milliseconds value set in the route config. Defaults to no override.
    - `varyEtag` - if `true`, a suffix will be automatically added to the 'ETag' header at transmission time (separated by a `'-'` character)
      when the HTTP 'Vary' header is present.

It provides the following methods:

- `bytes(length)` - sets the HTTP 'Content-Length' header (to avoid chunked transfer encoding) where:
    - `length` - the header value. Must match the actual payload size.
- `charset(charset)` - sets the 'Content-Type' HTTP header 'charset' property where:
    `charset` - the charset property value.
- `code(statusCode)` - sets the HTTP status code where:
    - `statusCode` - the HTTP status code.
- `created(location)` - sets the HTTP status code to Created (201) and the HTTP 'Location' header where:
    `location` - an absolute or relative URI used as the 'Location' header value. If a relative URI is provided, the value of
      the server [`location`](#server.config.location) configuration option is used as prefix. Not available for methods other than PUT and POST.
- `encoding(encoding)` - sets the string encoding scheme used to serial data into the HTTP payload where:
    `encoding` - the encoding property value (see [node Buffer encoding](http://nodejs.org/api/buffer.html#buffer_buffer)).
- `etag(tag, options)` - sets the representation [entity tag](http://tools.ietf.org/html/rfc7232#section-2.3) where:
    - `tag` - the entity tag string without the double-quote.
    - `options` - optional settings where:
        - `weak` - if `true`, the tag will be prefixed with the `'W/'` weak signifier. Weak tags will fail to match identical tags for the
          purpose of determining 304 response status. Defaults to `false`.
        - `vary` - if `true`, a suffix will be automatically added to the tag at transmission time (separated by a `'-'` character) when the
          HTTP 'Vary' header is present. Ignored when `weak` is `true`. Defaults to `true` when a tag is set using this method and when using
          the internal file or directory handlers, otherwise `false`.
- `header(name, value, options)` - sets an HTTP header where:
    - `name` - the header name.
    - `value` - the header value.
    - `options` - optional settings where:
        - `append` - if `true`, the value is appended to any existing header value using `separator`. Defaults to `false`.
        - `separator` - string used as separator when appending to an exiting value. Defaults to `','`.
        - `override` - if `false`, the header value is not set if an existing value present. Defaults to `true`.
- `location(location)` - sets the HTTP 'Location' header where:
    - `uri` - an absolute or relative URI used as the 'Location' header value. If a relative URI is provided, the value of the server
      [`location`](#server.config.location) configuration option is used as prefix.
- `redirect(location)` - sets an HTTP redirection response (302) and decorates the response with additional methods listed below, where:
    - `location` - an absolute or relative URI used to redirect the client to another resource. If a relative URI is provided, the value of
      the server [`location`](#server.config.location) configuration option is used as prefix.
- `state(name, value, [options])` - sets an HTTP cookie where:
    - `name` - the cookie name.
    - `value` - the cookie value. If no `encoding` is defined, must be a string.
    - `options` - optional configuration. If the state was previously registered with the server using [`server.state()`](#serverstatename-options),
      the specified keys in `options` override those same keys in the server definition (but not others).
- `ttl(msec)` - overrides the default route cache expiration rule for this response instance where:
    - `msec` - the time-to-live value in milliseconds.
- `type(mimeType)` - sets the HTTP 'Content-Type' header where:
    - `value` - is the mime type. Should only be used to override the built-in default for each response type.
- `unstate(name, [options])` - clears the HTTP cookie by setting an expired value where:
    - `name` - the cookie name.
    - `options` - optional configuration for expiring cookie. If the state was previously registered with the server using [`server.state()`](#serverstatename-options),
          the specified keys in `options` override those same keys in the server definition (but not others).
- `vary(header)` - adds the provided header to the list of inputs affected the response generation via the HTTP 'Vary' header where:
    - `header` - the HTTP request header name.

When the value provided by `reply()` requires stringification before transmission, the following methods are provided:

- `replacer(method)` - sets the `JSON.stringify()` `replacer` argument where:
    - `method` - the replacer function or array. Defaults to none.
- `spaces(count)` - sets the `JSON.stringify()` `space` argument where:
    - `count` - the number of spaces to indent nested object keys. Defaults to no indentation.

#### Response Object Redirect Methods
When using the `redirect()` method, the response object provides these additional methods:

- `temporary(isTemporary)` - sets the status code to `302` or `307` (based on the `rewritable()` setting) where:
    - `isTemporary` - if `false`, sets status to permanent. Defaults to `true`.
- `permanent(isPermanent)` - sets the status code to `301` or `308` (based on the `rewritable()` setting) where:
    - `isPermanent` - if `true`, sets status to temporary. Defaults to `false`.
- `rewritable(isRewritable)` - sets the status code to `301`/`302` for rewritable (allows changing the request method from 'POST' to 'GET') or
  `307`/`308` for non-rewritable (does not allow changing the request method from 'POST' to 'GET'). Exact code based on the `temporary()` or
  `permanent()` setting. Arguments:
    - `isRewritable` - if `false`, sets to non-rewritable. Defaults to `true`.

|                |  Permanent | Temporary |
| -------------- | ---------- | --------- |
| Rewritable     | 301        | **302**(1)|
| Non-rewritable | 308(2)     | 307       |

Notes:
1. Default value.
2. [Proposed code](http://tools.ietf.org/id/draft-reschke-http-status-308-07.txt), not supported by all clients.

### Response events

The response object supports the following events:

- `'peek'` - emitted for each chunk of data written back to the client connection. The event method signature is `function(chunk, encoding)`.
- `'finish'` - emitted when the response finished writing but before the client response connection is ended. The event method signature is
  `function ()`.

```javascript
var Crypto = require('crypto');
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onPreResponse', function (request, reply) {

    var response = request.response;
    if (response.isBoom) {
        return reply();
    }

    var hash = Crypto.createHash('sha1');
    response.on('peek', function (chunk) {

        hash.update(chunk);
    });

    response.once('finish', function () {

        console.log(hash.digest('hex'));
    });
});
```

## `Hapi.error`

Provides a set of utilities for returning HTTP errors. An alias of the [**boom**](https://github.com/hapijs/boom) module (can be also accessed
`Hapi.boom`). Each utility returns a `Boom` error response object (instance of `Error`) which includes the following properties:

- `isBoom` - if `true`, indicates this is a `Boom` object instance.
- `message` - the error message.
- `output` - the formatted response. Can be directly manipulated after object construction to return a custom error response. Allowed root keys:
    - `statusCode` - the HTTP status code (typically 4xx or 5xx).
    - `headers` - an object containing any HTTP headers where each key is a header name and value is the header content.
    - `payload` - the formatted object used as the response payload (stringified). Can be directly manipulated but any changes will be lost
      if `reformat()` is called. Any content allowed and by default includes the following content:
        - `statusCode` - the HTTP status code, derived from `error.output.statusCode`.
        - `error` - the HTTP status message (e.g. 'Bad Request', 'Internal Server Error') derived from `statusCode`.
        - `message` - the error message derived from `error.message`.
- inherited `Error` properties.

It also supports the following method:

- `reformat()` - rebuilds `error.output` using the other object properties.

```javascript
var Hapi = require('hapi');

var handler = function (request, reply) {

    var error = Hapi.error.badRequest('Cannot feed after midnight');
    error.output.statusCode = 499;    // Assign a custom error code
    error.reformat();

    error.output.payload.custom = 'abc_123'; // Add custom key

    reply(error);
});
```

### Error transformation

Error responses return a JSON object with the `statusCode`, `error`, and `message` keys. When a different error representation is desired, such
as an HTML page or using another format, the `'onPreResponse'` extension point may be used to identify errors and replace them with a different
response object.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();
server.views({
    engines: {
        html: require('handlebars')
    }
});

server.ext('onPreResponse', function (request, reply) {

    var response = request.response;
    if (!response.isBoom) {
        return reply();
    }

    // Replace error with friendly HTML

      var error = response;
      var ctx = {
          message: (error.output.statusCode === 404 ? 'page not found' : 'something went wrong')
      };

      reply.view('error', ctx);
});
```

#### `badRequest([message])`

Returns an HTTP Bad Request (400) error response object with the provided `message`.

```javascript
var Hapi = require('hapi');
Hapi.error.badRequest('Invalid parameter value');
```

#### `unauthorized(message, [scheme, [attributes]])`

Returns an HTTP Unauthorized (401) error response object where:

- `message` - the error message.
- `scheme` - optional HTTP authentication scheme name (e.g. `'Basic'`, `'Hawk'`). If provided, includes the HTTP 'WWW-Authenticate'
  response header with the scheme and any provided `attributes`.
- `attributes` - an object where each key is an HTTP header attribute and value is the attribute content.

```javascript
var Hapi = require('hapi');
Hapi.error.unauthorized('Stale timestamp', 'Hawk', { ts: fresh, tsm: tsm });
```

#### `unauthorized(message, wwwAuthenticate)`

Returns an HTTP Unauthorized (401) error response object where:

- `message` - the error message.
- `wwwAuthenticate` - an array of HTTP 'WWW-Authenticate' header responses for multiple challenges.

```javascript
var Hapi = require('hapi');
Hapi.error.unauthorized('Missing authentication', ['Hawk', 'Basic']);
```

#### `clientTimeout([message])`

Returns an HTTP Request Timeout (408) error response object with the provided `message`.

```javascript
var Hapi = require('hapi');
Hapi.error.clientTimeout('This is taking too long');
```

#### `serverTimeout([message])`

Returns an HTTP Service Unavailable (503) error response object with the provided `message`.

```javascript
var Hapi = require('hapi');
Hapi.error.serverTimeout('Too busy, come back later');
```

#### `forbidden([message])`

Returns an HTTP Forbidden (403) error response object with the provided `message`.

```javascript
var Hapi = require('hapi');
Hapi.error.forbidden('Missing permissions');
```

#### `notFound([message])`

Returns an HTTP Not Found (404) error response object with the provided `message`.

```javascript
var Hapi = require('hapi');
Hapi.error.notFound('Wrong number');
```

#### `internal([message, [data]])`

Returns an HTTP Internal Server Error (500) error response object where:

- `message` - the error message.
- `data` - optional data used for error logging. If `data` is an `Error`, the returned object is `data` decorated with
  the **boom** properties. Otherwise, the returned `Error` has a `data` property with the provided value.

Note that the `error.output.payload.message` is overridden with `'An internal server error occurred'` to hide any internal details from
the client. `error.message` remains unchanged.

```javascript
var Hapi = require('hapi');

var handler = function (request, reply) {

    var result;
    try {
        result = JSON.parse(request.query.value);
    }
    catch (err) {
        result = Hapi.error.internal('Failed parsing JSON input', err);
    }

    reply(result);
};
```

## `Hapi.Pack`

`Pack` is a collection of servers grouped together to form a single logical unit. The pack's primary purpose is to provide
a unified object interface when working with [plugins](#plugin-interface). Grouping multiple servers into a single pack
enables treating them as a single entity which can start and stop in sync, as well as enable sharing routes and other
facilities. For example, a Single Page Application (SPA) often requires a web component and an API component running as two
servers using distinct ports. Another common example is when plugins register both public routes as well as internal admin
routes, each on a different port but setup in a single plugin.

The servers in a pack share the same cache. Every server belongs to a pack, even if created directed via
[`new Server()`](#new-serverhost-port-options), in which case the `server.pack` object is automatically assigned a single-server pack.

#### `new Pack([options])`

Creates a new `Pack` object instance where:

- `options` - optional configuration:
    - `app` - an object used to initialize the application-specific data stored in `pack.app`.
    - `cache` - cache configuration as described in the server [`cache`](#server.config.cache) option.
    - `debug` - same as the server `debug` config option but applied to the entire pack.

```javascript
var Hapi = require('hapi');
var pack = new Hapi.Pack();
```

### `Pack` properties

Each `Pack` object instance has the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Initialized via the pack `app` configuration option. Defaults to `{}`.
- `events` - an `Events.EventEmitter` providing a consolidate emitter of all the events emitted from all member pack servers as well as
  the `'start'` and `'stop'` pack events.
- `plugins` - an object where each key is a plugin name and the value are the exposed properties by that plugin using
  [`plugin.expose()`](#pluginexposekey-value).

### `Pack` methods

#### `pack.server([host], [port], [options])`

Creates a `Server` instance and adds it to the pack, where `host`, `port`, `options` are the same as described in
[`new Server()`](#new-serverhost-port-options) with the exception that the `cache` option is not allowed and must be
configured via the pack `cache` option.

```javascript
var Hapi = require('hapi');
var pack = new Hapi.Pack();

pack.server(8000, { labels: ['web'] });
pack.server(8001, { labels: ['admin'] });
```

#### `pack.start([callback])`

Starts all the servers in the pack and used as described in [`server.start([callback])`](#serverstartcallback).

```javascript
var Hapi = require('hapi');
var pack = new Hapi.Pack();

pack.server(8000, { labels: ['web'] });
pack.server(8001, { labels: ['admin'] });

pack.start(function () {

    console.log('All servers started');
});
```

#### `pack.stop([options], [callback])`

Stops all the servers in the pack and used as described in [`server.stop([options], [callback])`](#serverstopoptions-callback).

```javascript
pack.stop({ timeout: 60 * 1000 }, function () {

    console.log('All servers stopped');
});
```

#### `pack.register(plugins, [options], callback)`

Registers a plugin where:

- `plugins` - a plugin object or array of plugin objects. The objects can use one of two formats:
    - a module plugin object.
    - a manually constructed plugin object.
- `options` - optional registration options (used by **hapi** and is not passed to the plugin):
    - `select` - string or array of strings of labels to pre-select for plugin registration.
    - `route` - apply modifiers to any routes added by the plugin:
        - `prefix` - string added as prefix to any route path (must begin with `'/'`). If a plugin registers a child plugin
          the `prefix` is passed on to the child or is added in front of the child-specific prefix.
        - `vhost` - virtual host string (or array of strings) applied to every route. The outter-most `vhost` overrides the any
          nested configuration.
- `callback` - the callback function with signature `function(err)` where:
    - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, or namespace conflicts
      (e.g. among routes, methods, state) will throw an error and will not return a callback.

Module plugin is registered by passing the following object (or array of object) as `plugins`:
- `plugin` - an object (usually obtained by calling node's `require()`) with:
    - `register` - the [`exports.register()`](#exportsregisterplugin-options-next) function. The function must have an `attributes`
      property with either `name` (and optional `version`) keys or `pkg` with the content of the module's 'package.json'.
- `options` - optional configuration object which is passed to the plugin via the `options` argument in
  [`exports.register()`](#exportsregisterplugin-options-next).

```javascript
server.pack.register({
    plugin: require('plugin_name'),
    options: {
        message: 'hello'
    }
 }, function (err) {

     if (err) {
         console.log('Failed loading plugin');
     }
 });
```

Manually constructed plugin is an object containing:
- `name` - plugin name.
- `version` - an optional plugin version. Defaults to `'0.0.0'`.
- `multiple` - an optional boolean indicating if the plugin is safe to register multiple time with the same server.
  Defaults to `false`.
- `register` - the [`register()`](#exportsregisterplugin-options-next) function.
- `options` - optional configuration object which is passed to the plugin via the `options` argument in
  [`exports.register()`](#exportsregisterplugin-options-next).

```javascript
server.pack.register({
    name: 'test',
    version: '2.0.0',
    register: function (plugin, options, next) {

        plugin.route({ method: 'GET', path: '/special', handler: function (request, reply) { reply(options.message); } });
        next();
    },
    options: {
        message: 'hello'
    }
}, function (err) {

    if (err) {
        console.log('Failed loading plugin');
    }
});
```

### `Pack.compose(manifest, [options], callback)`

Provides a simple way to construct a [`Pack`](#hapipack) from a single configuration object, including configuring servers
and registering plugins where:

- `manifest` - an object with the following keys:
    - `pack` - the pack `options` as described in [`new Pack()`](#packserverhost-port-options). In order to support loading JSON documents,
      The `compose()` function supports passing a module name string as the value of `pack.cache` or `pack.cache.engine`. These strings are
      resolved the same way the `plugins` keys are (using `options.relativeTo`).
    - `servers` - an array of server configuration objects where:
        - `host`, `port`, `options` - the same as described in [`new Server()`](#new-serverhost-port-options) with the exception that the
          `cache` option is not allowed and must be configured via the pack `cache` option. The `host` and `port` keys can be set to an
          environment variable by prefixing the variable name with `'$env.'`.
    - `plugins` - an object where each key is a plugin name, and each value is one of:
        - the `options` object passed to the plugin on registration.
        - an array of object where:
            - `options` - the object passed to the plugin on registration.
            - any key supported by the `pack.register()` options used for registration (e.g. `select`).
- `options` - optional compose configuration:
    - `relativeTo` - path prefix used when loading plugins using node's `require()`. The `relativeTo` path prefix is added to any
      relative plugin name (i.e. beings with `'./'`). All other module names are required as-is and will be looked up from the location
      of the **hapi** module path (e.g. if **hapi** resides outside of your project `node_modules` path, it will not find your project
      dependencies - you should specify them as relative and use the `relativeTo` option).
- `callback` - the callback method, called when all packs and servers have been created and plugins registered has the signature
  `function(err, pack)` where:
    - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, or namespace conflicts
      (e.g. among routes, methods, state) will throw an error and will not return a callback.
    - `pack` - the composed Pack object.

```javascript
var Hapi = require('hapi');

var manifest = {
    pack: {
        cache: 'catbox-memory'
    },
    servers: [
        {
            port: 8000,
            options: {
                labels: ['web']
            }
        },
        {
            host: 'localhost',
            port: 8001,
            options: {
                labels: ['admin']
            }
        }
    ],
    plugins: {
        'yar': {
            cookieOptions: {
                password: 'secret'
            }
        },
        'furball': [
            {
                select: 'web',
                options: {
                    version: '/v'
                }
            }
        ]
    }
};

Hapi.Pack.compose(manifest, function (err, pack) {

    pack.start();
});
```

## Plugin interface

Plugins provide an extensibility platform for both general purpose utilities such as [batch requests](https://github.com/hapijs/bassmaster)
and for application business logic. Instead of thinking about a web server as a single entity with a unified routing table, plugins enable
developers to break their application into logical units, assembled together in different combinations to fit the development, testing, and
deployment needs.

A plugin is constructed with the following:

- name - the plugin name is used as a unique key. Public plugins should be published in the [npm registry](https://npmjs.org) and derive
  their name from the registry name to ensure uniqueness. Private plugin names should be picked carefully to avoid conflicts with both
  private and public names.
- registration function - the function described in [`exports.register()`](#exportsregisterplugin-options-next) is the plugin's core.
  The function is called when the plugin is registered and it performs all the activities required by the plugin to operate. It is the
  single entry point into the plugin's functionality.
- version - the optional plugin version is only used informatively to enable other plugins to find out the versions loaded. The version
  should be the same as the one specified in the plugin's 'package.json' file.

The name and versions are included by attaching an `attributes` property to the `exports.register()` function:

```javascript
exports.register = function (plugin, options, next) {

    plugin.route({
        method: 'GET',
        path: '/version',
        handler: function (request, reply) {

            reply('1.0.0');
        }
    });

    next();
};

exports.register.attributes = {
    name: 'example',
    version: '1.0.0'
};
```

Alternatively, the name and version can be included via the `pkg` attribute containing the 'package.json' file for the module which
already has the name and version included:

```javascript
exports.register.attributes = {
    pkg: require('./package.json')
};
```

The `multiple` attributes specifies that a plugin is safe to register multiple times with the same server.

```javascript
exports.register.attributes = {
    multiple: true,
    pkg: require('./package.json')
};
```

#### `exports.register(plugin, options, next)`

Registers the plugin where:

- `plugin` - the registration interface representing the pack the plugin is being registered into. Provides the properties and methods listed below.
- `options` - the `options` object provided by the pack registration methods.
- `next` - the callback function the plugin must call to return control over to the application and complete the registration process. The function
  signature is `function(err)` where:
    - `err` - internal plugin error condition, which is returned back via the registration methods' callback. A plugin registration error is considered
      an unrecoverable event which should terminate the application.

```javascript
exports.register = function (plugin, options, next) {

    plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('hello world') } });
    next();
};
```

### Root methods and properties

The plugin interface root methods and properties are those available only on the `plugin` object received via the
[`exports.register()`](#exportsregisterplugin-options-next) interface. They are not available on the object received by calling
[`plugin.select()`](#pluginselectlabels).

#### `plugin.hapi`

A reference to the **hapi** module used to create the pack and server instances. Removes the need to add a dependency on **hapi** within the plugin.

```javascript
exports.register = function (plugin, options, next) {

    var Hapi = plugin.hapi;

    var handler = function (request, reply) {

        reply(Hapi.error.internal('Not implemented yet'));
    };

    plugin.route({ method: 'GET', path: '/', handler: handler });
    next();
};
```

#### `plugin.version`

The **hapi** version used to load the plugin.

```javascript
exports.register = function (plugin, options, next) {

    console.log(plugin.version);
    next();
};
```

#### `plugin.config`

The registration options provided to the `pack.register()` method. Contains:
- `route` - route path prefix and virtual host settings.

```javascript
exports.register = function (plugin, options, next) {

    console.log(plugin.config.route.prefix);
    next();
};
```

#### `plugin.app`

Provides access to the [common pack application-specific state](#pack-properties).

```javascript
exports.register = function (plugin, options, next) {

    plugin.app.hapi = 'joi';
    next();
};
```

#### `plugin.plugins`

An object where each key is a plugin name and the value are the exposed properties by that plugin using [`plugin.expose()`](#pluginexposekey-value)
when called at the plugin root level (without calling `plugin.select()`).

```javascript
exports.register = function (plugin, options, next) {

    console.log(plugin.plugins.example.key);
    next();
};
```

#### `plugin.path(path)`

Sets the path prefix used to locate static resources (files and view templates) when relative paths are used by the plugin:
- `path` - the path prefix added to any relative file path starting with `'.'`. The value has the same effect as using the server's
  configuration `files.relativeTo` option but only within the plugin.

```javascript
exports.register = function (plugin, options, next) {

    plugin.path(__dirname + '../static');
    plugin.route({ path: '/file', method: 'GET', handler: { file: './test.html' } });
    next();
};
```

#### `plugin.log(tags, [data, [timestamp]])`

Emits a `'log'` event on the `pack.events` emitter using the same interface as [`server.log()`](#serverlogtags-data-timestamp).

```javascript
exports.register = function (plugin, options, next) {

    plugin.log(['plugin', 'info'], 'Plugin registered');
    next();
};
```

#### `plugin.after(method)`

Add a method to be called after all the required plugins have been registered and before the servers start. The function is only
called if the pack servers are started. Arguments:

- `after` - the method with signature `function(plugin, next)` where:
    - `plugin` - the [plugin interface](#plugin-interface) object.
    - `next` - the callback function the method must call to return control over to the application and complete the registration process. The function
      signature is `function(err)` where:
        - `err` - internal plugin error condition, which is returned back via the [`pack.start(callback)`](#packstartcallback) callback. A plugin
          registration error is considered an unrecoverable event which should terminate the application.

```javascript
exports.register = function (plugin, options, next) {

    plugin.after(after);
    next();
};

var after = function (plugin, next) {

    // Additional plugin registration logic
    next();
};
```

#### `plugin.views(options)`

Generates a plugin-specific views manager for rendering templates where:
- `options` - the views configuration as described in the server's [`views`](#serverviewsoptions) option. Note that due to the way node
  `require()` operates, plugins must require rendering engines directly and pass the engine using the `engines.module` option.

Note that relative paths are relative to the plugin root, not the working directory or the application registering the plugin. This allows
plugin the specify their own static resources without having to require external configuration.

```javascript
exports.register = function (plugin, options, next) {

    plugin.views({
        engines: {
            html: {
              module: Handlebars.create()
            }
        },
        path: './templates'
    });

    next();
};
```

#### `plugin.method(name, fn, [options])`

Registers a server method function with all the pack's servers as described in [`server.method()`](#servermethodname-fn-options)

```javascript
exports.register = function (plugin, options, next) {

    plugin.method('user', function (id, next) {

        next(null, { id: id });
    });

    next();
};
```

#### `plugin.method(method)`

Registers a server method function with all the pack's servers as described in [`server.method()`](#servermethodmethod)

```javascript
exports.register = function (plugin, options, next) {

    plugin.method({
        name: 'user',
        fn: function (id, next) {

            next(null, { id: id });
        }
    });

    next();
};
```

#### `plugin.methods`

Provides access to the method methods registered with [`plugin.method()`](#pluginmethodname-fn-options)

```javascript
exports.register = function (plugin, options, next) {

    plugin.method('user', function (id, next) {

        next(null, { id: id });
    });

    plugin.methods.user(5, function (err, result) {

        // Do something with result

        next();
    });
};
```

#### `plugin.cache(options)`

Provisions a plugin cache segment within the pack's common caching facility where:

- `options` - cache configuration as described in [**catbox** module documentation](https://github.com/hapijs/catbox#policy) with a few additions:
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
      together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
      expire. Cannot be used together with `expiresIn`.
    - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`.
    - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
    - `generateTimeout` - number of milliseconds to wait before returning a timeout error when an item is not in the cache and the generate
      method is taking too long.
    - `segment` - optional segment name, used to isolate cached items within the cache partition. Defaults to '!name' where 'name' is the
      plugin name. When setting segment manually, it must begin with '!!'.
    - `cache` - the name of the cache connection configured in the ['server.cache` option](#server.config.cache). Defaults to the default cache.
    - `shared` - if true, allows multiple cache users to share the same segment (e.g. multiple servers in a pack using the same cache. Default
      to not shared.

```javascript
exports.register = function (plugin, options, next) {

    var cache = plugin.cache({ expiresIn: 60 * 60 * 1000 });
    next();
};
```

#### `plugin.bind(bind)`

Sets a global plugin bind used as the default bind when adding a route or an extension using the plugin interface (if no
explicit bind is provided as an option). The bind object is made available within the handler and extension methods via `this`.

```javascript
var handler = function (request, reply) {

    request.reply(this.message);
};

exports.register = function (plugin, options, next) {

    var bind = {
        message: 'hello'
    };

    plugin.bind(bind);
    plugin.route({ method: 'GET', path: '/', handler: handler });
    next();
};
```

#### `plugin.handler(name, method)`

Registers a new handler type as describe in [`server.handler(name, method)`](#serverhandlername-method).

```javascript
exports.register = function (plugin, options, next) {

    var handlerFunc = function (route, options) {

        return function (request, reply) {

            reply('Message from plugin handler: ' + options.msg);
        }
    };

    plugin.handler('testHandler', handlerFunc);
    next();
}
```

#### `plugin.render(template, context, [options], callback)`

Utilizes the plugin views engine configured to render a template where:
- `template` - the template filename and path, relative to the templates path configured via ['plugin.views()`](#pluginviewsoptions).
- `context` - optional object used by the template to render context-specific result. Defaults to no context `{}`.
- `options` - optional object used to override the plugin's ['plugin.views()`](#pluginviewsoptions) configuration.
- `callback` - the callback function with signature `function (err, rendered, config)` where:
    - `err` - the rendering error if any.
    - `rendered` - the result view string.
    - `config` - the configuration used to render the template.

```javascript
exports.register = function (plugin, options, next) {

    plugin.views({
        engines: {
            html: {
              module: Handlebars.create()
            }
        },
        path: './templates'
    });

    plugin.render('hello', context, function (err, rendered, config) {

        console.log(rendered);
        next();
    });
};
```

### Selectable methods and properties

The plugin interface selectable methods and properties are those available both on the `plugin` object received via the
[`exports.register()`](#exportsregisterplugin-options-next) interface and the objects received by calling
[`plugin.select()`](#pluginselectlabels). However, unlike the root methods, they operate only on the selected subset of
servers.

#### `plugin.select(labels)`

Selects a subset of pack servers using the servers' `labels` configuration option where:

- `labels` - a single string or array of strings of labels used as a logical OR statement to select all the servers with matching
  labels in their configuration.

Returns a new `plugin` interface with only access to the [selectable methods and properties](#selectable-methods-and-properties).
Selecting again on a selection operates as a logic AND statement between the individual selections.

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('web');
    selection.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
    next();
};
```

#### `plugin.length`

The number of selected servers.

```javascript
exports.register = function (plugin, options, next) {

    var count = plugin.length;
    var selectedCount = plugin.select('web').length;
    next();
};
```

#### `plugin.servers`

The selected servers array.

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('web');
    selection.servers.forEach(function (server) {

        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
    });

    next();
};
```

#### `plugin.events`

An emitter containing the events of all the selected servers.

```javascript
exports.register = function (plugin, options, next) {

    plugin.events.on('internalError', function (request, err) {

        console.log(err);
    });

    next();
};
```

#### `plugin.expose(key, value)`

Exposes a property via `plugin.plugins[name]` (if added to the plugin root without first calling `plugin.select()`) and `server.plugins[name]`
('name' of plugin) object of each selected pack server where:

- `key` - the key assigned (`server.plugins[name][key]` or `plugin.plugins[name][key]`).
- `value` - the value assigned.

```javascript
exports.register = function (plugin, options, next) {

    plugin.expose('util', function () { console.log('something'); });
    next();
};
```

#### `plugin.expose(obj)`

Merges a deep copy of an object into to the existing content of `plugin.plugins[name]` (if added to the plugin root without first calling
`plugin.select()`) and `server.plugins[name]` ('name' of plugin) object of each selected pack server where:

- `obj` - the object merged into the exposed properties container.

```javascript
exports.register = function (plugin, options, next) {

    plugin.expose({ util: function () { console.log('something'); } });
    next();
};
```

#### `plugin.route(options)`

Adds a server route to the selected pack's servers as described in [`server.route(options)`](#serverrouteoptions).

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('web');
    selection.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
    next();
};
```

#### `plugin.route(routes)`

Adds multiple server routes to the selected pack's servers as described in [`server.route(routes)`](#serverrouteroutes).

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('admin');
    selection.route([
        { method: 'GET', path: '/1', handler: function (request, reply) { reply('ok'); } },
        { method: 'GET', path: '/2', handler: function (request, reply) { reply('ok'); } }
    ]);

    next();
};
```

#### `plugin.state(name, [options])`

Adds a state definition to the selected pack's servers as described in [`server.state()`](#serverstatename-options).

```javascript
exports.register = function (plugin, options, next) {

    plugin.state('example', { encoding: 'base64' });
    next();
};
```

#### `plugin.auth.scheme(name, scheme)`

Adds an authentication scheme to the selected pack's servers as described in [`server.auth.scheme()`](#serverauthschemename-scheme).

#### `plugin.auth.strategy(name, scheme, [mode], [options])`

Adds an authentication strategy to the selected pack's servers as described in [`server.auth.strategy()`](#serverauthstrategyname-scheme-mode-options).

#### `plugin.ext(event, method, [options])`

Adds an extension point method to the selected pack's servers as described in [`server.ext()`](#serverextevent-method-options).

```javascript
exports.register = function (plugin, options, next) {

    plugin.ext('onRequest', function (request, extNext) {

        console.log('Received request: ' + request.path);
        extNext();
    });

    next();
};
```

#### `plugin.register(plugins, [options], callback)`

Adds a plugin to the selected pack's servers as described in [`pack.register()`](#packregisterplugins-options-callback).

```javascript
exports.register = function (plugin, options, next) {

    plugin.register({
        plugin: require('plugin_name'),
        options: {
            message: 'hello'
        }
    }, next);
};
```

#### `plugin.dependency(deps, [after])`

Declares a required dependency upon other plugins where:

- `deps` - a single string or array of strings of plugin names which must be registered in order for this plugin to operate. Plugins listed
  must be registered in the same pack transaction to allow validation of the dependency requirements. Does not provide version dependency which
  should be implemented using [npm peer dependencies](http://blog.nodejs.org/2013/02/07/peer-dependencies/).
- `after` - an optional function called after all the specified dependencies have been registered and before the servers start. The function is only
  called if the pack servers are started. If a circular dependency is created, the call will assert (e.g. two plugins each has an `after` function
  to be called after the other). The function signature is `function(plugin, next)` where:
    - `plugin` - the [plugin interface](#plugin-interface) object.
    - `next` - the callback function the method must call to return control over to the application and complete the registration process. The function
      signature is `function(err)` where:
        - `err` - internal plugin error condition, which is returned back via the [`pack.start(callback)`](#packstartcallback) callback. A plugin
          registration error is considered an unrecoverable event which should terminate the application.

```javascript
exports.register = function (plugin, options, next) {

    plugin.dependency('yar', after);
    next();
};

var after = function (plugin, next) {

    // Additional plugin registration logic
    next();
};
```

## `Hapi.state`

#### `prepareValue(name, value, options, callback)`

Prepares a cookie value manually outside of the normal outgoing cookies processing flow. Used when decisions have to be made about
the use of cookie values when certain conditions are met (e.g. stringified object string too long). Arguments:

- `name` - the cookie name.
- `value` - the cookie value. If no `encoding` is defined, must be a string.
- `options` - configuration override. If the state was previously registered with the server using [`server.state()`](#serverstatename-options),
  the specified keys in `options` override those same keys in the server definition (but not others).
- `callback` - the callback function with signature `function(err, value)` where:
    - `err` - internal error condition.
    - `value` - the prepared cookie value.

Returns the cookie value via callback without making any changes to the response.

```javascript
var Hapi = require('hapi');

var handler = function (request, reply) {

    var maxCookieSize = 512;

    var cookieOptions = {
        encoding: 'iron',
        password: 'secret'
    };

    var content = request.pre.user;

    Hapi.state.prepareValue('user', content, cookieOptions, function (err, value) {

        if (err) {
            return reply(err);
        }

        if (value.length < maxCookieSize) {
            reply.state('user', value, { encoding: 'none' } );   // Already encoded
        }

        reply('success');
    });
};
```

## `Hapi.version`

The **hapi** module version number.

```javascript
var Hapi = require('hapi');
console.log(Hapi.version);
```

## `hapi CLI`

The **hapi** command line interface allows a pack of servers to be composed and started from a configuration file
only from the command line. When installing **hapi** with the global flag the **hapi** binary script will be
installed in the path.  The following arguments are available to the **hapi** CLI:

- '-c' - the path to configuration json file (required)
- '-p' - the path to the node_modules folder to load plugins from (optional)
- '--require' - a module the cli will require before hapi is required (optional) ex. loading a metrics library

Note that `--require` will require from `node_modules`, an absolute path, a relative path, or from the `node_modules`
set by `-p` if available.

When using the CLI to compose a pack of servers, all values in the configuration json file can be set to an
environment variable by prefixing the variable name with`'$env.'`.

In order to help with A/B testing there is [confidence](https://github.com/hapijs/confidence). Confidence is a
configuration document format, an API, and a foundation for A/B testing. The configuration format is designed to
work with any existing JSON-based configuration, serving values based on object path ('/a/b/c' translates to a.b.c).
In addition, confidence defines special $-prefixed keys used to filter values for a given criteria.
