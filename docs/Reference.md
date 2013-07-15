# 1.8.x API Reference

- [`Hapi.Server`](#hapiserver)
    - [`new Server([host], [port], [options])`](#new-serverhost-port-options)
    - [`createServer([host], [port], [options])`](#createServerhost-port-options)
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
        - [`server.routingTable()`](#serverroutingtable)
        - [`server.log(tags, [data, [timestamp]])`](#serverlogtags-data-timestamp)
        - [`server.state(name, [options])`](#serverstatename-options)
        - [`server.views(options)`](#serverviewsoptions)
        - [`server.auth(name, options)`](#serverauthname-options)
            - [Basic authentication](#basic-authentication)
            - [Cookie authentication](#cookie-authentication)
            - [Hawk authentication](#hawk-authentication)
            - [Bewit authentication](#bewit-authentication)
        - [`server.ext(event, method, [options])`](#serverextevent-method-options)
            - [Request lifecycle](#request-lifecycle)
        - [`server.helper(name, method, [options])`](#serverhelpername-method-options)
        - [`server.inject(options, callback)`](#serverinjectoptions-callback)
    - [`Server` events](#server-events)
- [Request object](#request-object)
    - [`request` properties](#request-properties)
    - [`request` methods](#request-methods)
        - [`request.setUrl(url)`](#requestseturlurl)
        - [`request.setMethod(method)`](#requestsetmethodmethod)
        - [`request.log(tags, [data, [timestamp]])`](#requestlogtags-data-timestamp)
        - [`request.getLog([tags])`](#requestgetlogtags)
        - [`request.tail([name])`](#requesttailname)
        - [`request.setState(name, value, [options])`](#requestsetstatename-value-options)
        - [`request.clearState(name)`](#requestclearstatename)
        - [`request.reply([result])`](#requestreplyresult)
            - [`request.reply.redirect(uri)`](#requestreplyredirecturi)
            - [`request.reply.view(template, [context, [options]])`](#requestreplyviewtemplate-context-options)
            - [`request.reply.close()`](#requestreplyclose)
        - [`request.generateView(template, context, [options])`](#requestgenerateviewtemplate-context-options)
        - [`request.response()`](#requestresponse)
- [`Hapi.response`](#hapiresponse)
    - [Flow control](#flow-control)
    - [Response types](#response-types)
        - [`Generic`](#generic)
        - [`Empty`](#empty)
        - [`Text`](#text)
        - [`Buffer`](#buffer)
        - [`Stream`](#stream)
        - [`Obj`](#obj)
        - [`File`](#file)
        - [`Redirection`](#redirection)
        - [`View`](#view)
        - [`Cacheable`](#cacheable)
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
      - [`passThrough(code, payload, contentType, headers)`](#passthroughcode-payload-contenttype-headers)
- [`Hapi.Pack`](#hapipack)
      - [`new Pack([options])`](#new-packoptions)
      - [`Pack` properties](#pack-properties)
      - [`Pack` methods](#pack-methods)
          - [`pack.server([host], [port], [options])`](#packserverhost-port-options)
          - [`pack.start([callback])`](#packstartcallback)
          - [`pack.stop([options], [callback])`](#packstopoptions-callback)
          - [`pack.allow(permissions)`](#packallowpermissions)
          - [`pack.require(name, options, callback)`](#packrequirename-options-callback)
          - [`pack.require(names, callback)`](#packrequirenames-callback)
          - [`pack.register(plugin, options, callback)`](#packregisterplugin-options-callback)
- [`Hapi.Composer`](#hapicomposer)
      - [`new Composer(manifest)`](#new-composermanifest)
      - [`composer.compose(callback)`](#composercomposecallback)
      - [`composer.start([callback])`](#composerstartcallback)
      - [`composer.stop([options], [callback])`](#composerstopoptions-callback)
- [Plugin interface](#plugin-interface)
    - [`exports.register(plugin, options, next)`](#exportsregisterplugin-options-next)
    - [Root methods and properties](#root-methods-and-properties)
        - [`plugin.version`](#pluginversion)
        - [`plugin.path`](#pluginpath)
        - [`plugin.hapi`](#pluginhapi)
        - [`plugin.app`](#pluginapp)
        - [`plugin.events`](#pluginevents)
        - [`plugin.log(tags, [data, [timestamp]])`](#pluginlogtags-data-timestamp)
        - [`plugin.dependency(deps)`](#plugindependencydeps)
        - [`plugin.views(options)`](#pluginviewsoptions)
        - [`plugin.helper(name, method, [options])`](#pluginhelpername-method-options)
        - [`plugin.cache(options)`](#plugincacheoptions)
    - [Selectable methods and properties](#selectable-methods-and-properties)
        - [`plugin.select(labels)`](#pluginselectlabels)
        - [`plugin.length`](#pluginlength)
        - [`plugin.api(key, value)`](#pluginapikey-value)
        - [`plugin.api(obj)`](#pluginapiobj)
        - [`plugin.route(options)`](#pluginrouteoptions)
        - [`plugin.route(routes)`](#pluginrouteroutes)
        - [`plugin.state(name, [options])`](#pluginstatename-options)
        - [`plugin.auth(name, options)`](#pluginauthname-options)
        - [`plugin.ext(event, method, [options])`](#pluginextevent-method-options)
- [`Hapi.utils`](#hapiutils)
      - [`version()`](#version)
- [`Hapi.types`](#hapitypes)
- [`Hapi.state`](#hapistate)
      - [`prepareValue(name, value, options, callback)`](#preparevaluename-value-options-callback)

## `Hapi.Server`

### `new Server([host], [port], [options])`

Creates a new server instance with the following arguments:

- `host` - the hostname or IP address the server is bound to. Defaults to `0.0.0.0` which means any available network
  interface. Set to `127.0.0.1` or `localhost` to restrict connection to those coming from the same machine.
- `port` - the TPC port the server is listening to. Defaults to port `80` for HTTP and to `443` when TLS is configured.
  to use an ephemeral port, use `0` and once the server is started, retrieve the port allocation via `server.info.port`.
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

- `app` - application-specific configuration. Provides a safe place to store application configuration without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
<p></p>
- `auth` - configures one or more authentication strategies. The `auth` key can be set to a single strategy object (the name will default to `'default'`),
  or to an object with multiple strategies where the strategy name is the object key. The authentication strategies and their options are described in
  [`server.auth()`](#serverauthname-options).
<p></p>
- <a name="server.config.cache"></a>`cache` - determines the type of server-side cache used. Every server includes a cache for storing and reusing request
  responses and helper results. By default a simple memory-based cache is used which has very limited capacity and is not suitable for production
  environments. In addition to the memory cache, a Redis-based or a MongoDB-based cache can be configured. Actual caching is only utilized if routes,
  helpers, and plugins are explicitly configured to store their state in the cache. The server cache configuration only defines the store itself. The
  `cache` options are described in the [**catbox** module documentation](https://github.com/spumko/catbox#client).
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
- <a name="server.config.files"></a>`files` - defines the behavior for serving static resources using the built-in route handlers for files and directories:
    - `relativeTo` - determines how relative paths are resolved. Available values:
        - `'cwd'` - relative paths are resolved using the active process path (`process.cwd()`). This is the default setting.
        - `'routes'` - relative paths are resolved relative to the source file in which the `server.route()` method is called. This means the
          location of the source code determines the location of the static resources when using relative paths.
        - an absolute path (e.g. '/path') used as prefix for all relative paths.
<p></p>
- `labels` - a string array of labels used when registering plugins to [`plugin.select()`](#pluginselectlabels) matching server labels. Defaults
  to an empty array `[]` (no labels).
<p></p>
- <a name="server.config.location"></a>`location` - used to convert relative 'Location' header URIs to absolute, by adding this value as prefix. Value must not contain a trailing `'/'`.
  Defaults to the host received in the request HTTP 'Host' header and if missing, to `server.info.uri`.
<p></p>
- <a name="server.config.payload"></a>`payload` - controls how incoming payloads (request body) are processed:
    - `maxBytes` - limits the size of incoming payloads to the specified byte count. Allowing very large payloads may cause the server to run
      out of memory. Defaults to `1048576` (1MB).
<p></p>
- `plugins` - plugin-specific configuration. Provides a place to store and pass plugin configuration that is at server-level. The `plugins` is
  an object where each key is a plugin name and the value is the configuration.
<p></p>
- <a name="server.config.router"></a>`router` - controls how incoming request URIs are matched against the routing table:
    - `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to `true`.
    - `normalizeRequestPath` - determines whether request paths should be normalized prior to matching. Normalization percent-encodes reserved
      characters, decodes unreserved characters, and capitalizes any percent encoded values. Useful when serving non-compliant HTTP clients.
      Defaults to `false`.
<p></p>
- <a name="server.config.state"></a>`state` - HTTP state management (cookies) allows the server to store information on the client which is sent back to the server with every
  request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)).
    - `cookies` - The server automatically parses incoming cookies based on these options:
        - `parse` - determines if incoming 'Cookie' headers are parsed and stored in the `request.cookies` object. Defaults to `true`.
        - `failAction` - determines how to handle cookie parsing errors. Allowed values are:
            - `'error'` - return a Bad Request (400) error response. This is the default value.
            - `'log'` - report the error but continue processing the request.
            - `'ignore'` - take no action.
        - `clearInvalid` - if `true`, automatically instruct the client to remove invalid cookies. Defaults to `false`.
        - `strictHeader` - if `false`, allows any cookie value including values in violation of [RFC 6265](https://tools.ietf.org/html/rfc6265). Defaults to `true`.
<p></p>
- `timeout` - define timeouts for processing durations:
    - `server` - response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an incoming client request before giving
      up and responding with a Service Unavailable (503) error response. Disabled by default (`false`).
    - `client` - request timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body) before giving up
      and responding with a Request Timeout (408) error response. Set to `false` to disable. Defaults to `10000` (10 seconds).
    - `socket` - by default, node sockets automatically timeout after 2 minutes. Use this option to override this behavior. Defaults to `undefined`
      which leaves the node default unchanged. Set to `false` to disable socket timeouts.
<p></p>
- `tls` - used to create an HTTPS server. The `tls` object is passed unchanged as options to the node.js HTTPS server as described in the
  [node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).
<p></p>
- `maxSockets` - used to set the number of sockets available per outgoing host connection.  Default is null.  This impacts all servers sharing the process.
<p></p>
- <a name="server.config.views"></a>`views` - enables support for view rendering (using templates to generate responses). Disabled by default.
  To enable, set to an object with the following options:
    - `engines` - (required) an object where each key is a file extension (e.g. 'html', 'jade'), mapped to the npm module name (string) used for
      rendering the templates. Alternatively, the extension can be mapped to an object with the following options:
        - `module` - the npm module name (string) to require or an object with:
            - `compile()` - the rendering function. The required function signature depends on the `compileMode` settings. If the `compileMode` is
              `'sync'`, the signature is `compile(template, options)`, the return value is a function with signature `function(context, options)`,
              and the method is allowed to throw errors. If the `compileMode` is `'async'`, the signature is `compile(template, options, callback)`
              where `callback` has the signature `function(err, compiled)` where `compiled` is a function with signature `function(context, options)`.
        - any of the `views` options listed below (except `defaultExtension`) to override the defaults for a specific engine.
    - `defaultExtension` - defines the default filename extension to append to template names when multiple engines are configured and not
      explicit extension is provided for a given template. No default value.
    - `path` - the root file path used to resolve and load the templates identified when calling `request.reply.view()`. Defaults to current working
      directory.
    - `partialsPath` - the root file path where partials are located. Partials are small segments of template code that can be nested and reused
      throughout other templates. Defaults to no partials support (empty path).
    - `helpersPath` - the directory path where helpers are located. Helpers are functions used within templates to perform transformations
      and other data manipulations using the template context or other inputs. Each '.js' file in the helpers directory is loaded and the file name
      is used as the helper name. The files must export a single method with the signature `function(context)` and return a string. Sub-folders are
      not supported and are ignored. Defaults to no helpers support (empty path).
    - `basePath` - a base path used as prefix for `path` and `partialsPath`. No default.
    - `layout` - if set to `true`, layout support is enabled. A layout is a single template file used as the parent template for other view templates
      in the same engine. The layout template name must be 'layout.ext' where 'ext' is the engine's extension.  Disable 'layout' when using Jade as
      it will handle including any layout files independently of Hapi.  Defaults to `false`.
    - `layoutKeyword` - the key used by the template engine to denote where primary template content should go. Defaults to `'content'`.
    - `encoding` - the text encoding used by the templates when reading the files and outputting the result. Defaults to `'utf-8'`.
    - `isCached` - if set to `false`, templates will not be cached (thus will be read from file on every use). Defaults to `true`.
    - `allowAbsolutePaths` - if set to `true`, allows absolute template paths passed to `request.reply.view()`. Defaults to `false`.
    - `allowInsecureAccess` - if set to `true`, allows template paths passed to `request.reply.view()` to contain '../'. Defaults to `false`.
    - `compileOptions` - options object passed to the engine's compile function. Defaults to empty options `{}`.
    - `runtimeOptions` - options object passed to the returned function from the compile operation. Defaults to empty options `{}`.
    - `contentType` - the content type of the engine results. Defaults to `'text/html'`.
    - `compileMode` - specify whether the engine `compile()` method is `'sync'` or `'async'`. Defaults to `'sync'`.

### `Server` properties

Each instance of the `Server` object have the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `helpers` - helper functions registered with [`server.helper()`](#serverhelpername-method-options).
- `info` - server information:
    - `port` - the port the server was configured to (before `start()`) or bound to (after `start()`).
    - `host` - the hostname the server was configured to (defaults to `'0.0.0.0'` if no host was provided).
    - `protocol` - the protocol used (e.g. `'http'` or `'https'`).
    - `uri` - a string with the following format: 'protocol://host:port' (e.g. 'http://example.com:8080').
- `listener` - the node HTTP server object.
- `pack` - the [`Pack`](#hapipack) object the server belongs to (automatically assigned when creating a server instance directly).
- `plugins` - an object where each key is a plugin name and the value is the API registered by that plugin using [`plugin.api()`](#pluginapikey-value).
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
<p></p>
- `method` - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'.
  Use `*` to match against any HTTP method (only when an exact match was not found).
<p></p>
- `vhost` - an optional domain string or an array of domain strings for limiting the route to only requests with a matching host header field.
  Matching is done against the hostname part of the header only (excluding the port). Defaults to all hosts.
<p></p>
- `handler` - (required) the function called to generate the response after successful authentication and validation. The handler function is
  described in [Route handler](#route-handler). Alternatively, `handler` can be set to the string `'notfound'` to return a Not Found (404)
  error response, or `handler` can be assigned an object with one of:
    - <a name="route.config.file"></a>`file` - generates a static file endpoint for serving a single file. `file` can be set to:
        - a relative or absolute file path string (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
        - a function with the signature `function(request)` which returns the relative or absolute file path.
        - an object with the following options:
            - `path` - a path string or function as described above.
            - `mode` - specifies whether to include the 'Content-Disposition' header with the response. Available values:
                - `false` - header is not included. This is the default value.
                - `'attachment'`
                - `'inline'`
<p></p>
    - <a name="route.config.directory"></a>`directory` - generates a directory endpoint for serving static content from a directory. Routes using the directory handler must include a
      single path parameter at the end of the path string (e.g. '/path/to/somewhere/{param}' where the parameter name does not matter). The path
      parameter can use any of the parameter options (e.g. '{param}' for one level files only, '{param?}' for one level files or the directory root,
      '{param*}' for any level, or '{param*3}' for a specific level). The directory handler is an object with the following options:
        - `path` - (required) the directory root path (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
          Value can be:
            - a single path string used as the prefix for any resources requested by appending the request path parameter to the provided string.
            - an array of path strings. Each path will be attempted in order until a match is found (by following the same process as the single path string).
            - a function with the signature `function(request)` which returns the path string.
        - `index` - optional boolean, determines if 'index.html' will be served if found in the folder when requesting a directory. Defaults to `true`.
        - `listing` - optional boolean, determines if directory listing is generated when a directory is requested without an index document.
          Defaults to `false`.
        - `showHidden` - optional boolean, determines if hidden files will be shown and served. Defaults to `false`.
        - `redirectToSlash` - optional boolean, determines if requests for a directory without a trailing slash are redirected to the same path with
          the missing slash. Useful for ensuring relative links inside the response are resolved correctly.
<p></p>
    - `proxy` - generates a reverse proxy handler with the following options:
        - `host` - the upstream service host to proxy requests to.  The same path on the client request will be used as the path on the host.
        - `port` - the upstream service port.
        - `protocol` - The protocol to use when making a request to the proxied host:
            - `'http'`
            - `'https'`
        - `passThrough` - if `true`, forwards the headers sent from the client to the upstream service being proxied to. Defaults to `false`.
        - `rejectUnauthorized` - sets the _'rejectUnauthorized'_ property on the https [agent](http://nodejs.org/api/https.html#https_https_request_options_callback) making the request.
        This value is only used when the proxied server uses TLS/SSL.  When set it will override the node.js _'rejectUnauthorized'_ property.  If _'false'_ then ssl errors will be ignored.
        When _'true'_ the server certificate is verified and an 500 response will be sent when verification fails.  Defaults to the https agent default value of _'true'_.
        - `xforward` - if `true`, sets the 'X-Forwarded-For', 'X-Forwarded-Port', 'X-Forwarded-Proto' headers when making a request to the
          proxied upstream endpoint. Defaults to `false`.
        - `redirects` - the maximum number of HTTP redirections allowed, to be followed automatically by the handler. Set to `false` or `0` to
          disable all redirections (the response will contain the redirection received from the upstream service). If redirections are enabled,
          no redirections (301, 302, 307, 308) will be passed along to the client, and reaching the maximum allowed redirections will return an
          error response. Defaults to `false`.
        - `mapUri` - a function used to map the request URI to the proxied URI. Cannot be used together with `host`, `port`, or `protocol`.
          The function signature is `function(request, callback)` where:
            - `request` - is the incoming `request` object
            - `callback` - is `function(err, uri, headers)` where:
                - `err` - internal error condition.
                - `uri` - the absolute proxy URI.
                - `headers` - optional object where each key is an HTTP request header and the value is the header content.
        - `postResponse` - a custom function for processing the response from the upstream service before sending to the client. Useful for
          custom error handling of responses from the proxied endpoint or other payload manipulation. Function signature is
          `function(request, settings, res, payload)` where:
              - `request` - is the incoming `request` object. It is the responsibility of the `postResponse()` function to call `request.reply()`.
              - `settings` - the proxy handler configuration.
              - `res` - the node response object received from the upstream service.
              - `payload` - the response payload.
<p></p>
    - <a name="route.config.view"></a>`view` - generates a template-based response. The `view` options is set to the desired template file name.
      The view context available to the template includes:
        - `payload` - maps to `request.payload`.
        - `params` - maps to `request.params`.
        - `query` - maps to `request.query`.
<p></p>
- `config` - additional route configuration (the `config` options allows splitting the route information from its implementation):
    - `handler` - an alternative location for the route handler function. Same as the `handler` option in the parent level. Can only
      include one handler per route.
<p></p>
    - `pre` - an array with prerequisites methods which are executed in serial or in parallel before the handler is called and are
      described in [Route prerequisites](#route-prerequisites).
<p></p>
    - `validate`
        - `query` - validation rules for an incoming request URI query component (the key-value part of the URI between '?' and '#').
          The query is parsed into its individual key-value pairs (see
          [Query String](http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)) and stored in
          `request.query` prior to validation. Values allowed:
            - `true` - any query parameters allowed (no validation performed). This is the default.
            - `false` - no query parameters allowed.
            - a validation rules object as described in the [Joi](http://github.com/spumko/joi) module.
<p></p>
        - `payload` - validation rules for an incoming request payload (request body). Values allowed:
            - `true` - any payload allowed (no validation performed). This is the default.
            - `false` - no payload allowed.
            - a validation rules object as described in the [Joi](http://github.com/spumko/joi) module.
<p></p>
        - `path` - validation rules for incoming request path parameters, after matching the path against the route and extracting any
          parameters then stored in `request.params`. Values allowed:
            - `true` - any path parameters allowed (no validation performed).  This is the default.
            - `false` - no path variables allowed.
            - a validation rules object as described in the [Joi](http://github.com/spumko/joi) module.
<p></p>
        - `response` - validation rules for the outgoing response payload (response body). Can only validate [object](#obj) response. Values allowed:
            - `true` - any payload allowed (no validation performed). This is the default.
            - `false` - no payload allowed.
            - an object with the following options:
                - `schema` - the validation schema as described in the [Joi](http://github.com/spumko/joi) module.
                - `sample` - the percent of responses validated (0 - 100). Set to `0` to disable all validation. Defaults to `100` (all responses).
                - `failAction` - defines what to do when a response fails validation. Options are:
                    - `error` - return an Internal Server Error (500) error response. This is the default value.
                    - `log` - log the error but send the response.
<p></p>
    - `payload` - determines how the request payload is processed. `payload` can be assigned a string with the parsing mode directly (e.g. `'parse'`)
      which will use the default values of the other settings, or an object with the following:
        - `mode` - the parsing mode. Defaults to `'parse'` if `validate.payload` is set or when `method` is
          `'POST'`, `'PUT'` or `'PATCH'`, otherwise `'stream'`. Payload processing is configured using the server [`payload`](#server.config.payload) configuration.
          Options are:
            - `'stream'` - the incoming request stream is left untouched, leaving it up to the handler to process the request via `request.raw.req`.
            - `'raw'` - the payload is read and stored in `request.rawPayload` as a `Buffer` and is not parsed.
            - `'parse'` - the payload is read and stored in `request.rawPayload` as a `Buffer`, and then parsed (JSON or form-encoded) and stored
              in `request.payload`. Parsing is performed based on the incoming request 'Content-Type' header. If the parsing is enabled and the
              format is unknown, a Bad Request (400) error response is sent. The supported mime types are:
                - application/json
                - application/x-www-form-urlencoded
                - application/octet-stream
                - multipart/form-data ([multiparty](https://npmjs.org/package/multiparty) is used for processing this data and is capable of
                  receiving files as well as other form data.  All values are assigned to their respective form names in `request.payload`.
            - `'try'` - same as `'parse'` but does not return an error on failed parsing. Instead, leaves `request.payload` undefined.
        - `allow` - a string or an array of strings with the allowed mime types for the endpoint. Defaults to any of the supported mime types listed
          above. Note that allowing other mime types not listed will not enable them to be parsed, and that if parsing mode is `'parse'`, the request
          will result in an error response.
        - `override` - a mime type string overriding the 'Content-Type' header value received. Defaults to no override.
<p></p>
    - `cache` - if the route method is 'GET', the route can be configured to use the cache. The `cache` options are described in
      the [**catbox** module documentation](https://github.com/spumko/catbox#policy) with some additions:
        - `mode` - cache location. Available values:
            - `'client'` - caching is performed on the client by sending the HTTP `Cache-Control` header. This is the default value.
            - `'server'` - caching is performed on the server using the cache strategy configured.
            - `'client+server'` - caching it performed on both the client and server.
        - `segment` - optional segment name, used to isolate cached items within the cache partition. Defaults to the route fingerprint
          (the route path with parameters represented by a `'?'` character). Note that when using the MongoDB cache strategy, some paths
          will require manual override as their fingerprint will conflict with MongoDB collection naming rules. When setting segment
          names manually, the segment must begin with `'//'`.
        - `privacy` - determines the privacy flag included in client-side caching using the 'Cache-Control' header. Values are:
            - `'default'` - no privacy flag. This is the default setting.
            - `'public'` - mark the response as suitable for public caching.
            - `'private'` - mark the response as suitable only for private caching.
        - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
          together with `expiresAt`.
        - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
          expire. Cannot be used together with `expiresIn`.
        - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`. Available
          only when using server-side caching.
        - `staleTimeout` - number of milliseconds to wait before checking if an item is stale. Available only when using server-side caching.
<p></p>
    - `auth` - authentication configuration. Value can be:
        - a string with the name of an authentication strategy registered with `server.auth()`.
        - a boolean where `false` means no authentication, and `true` sets to the default authentication strategy which is available only
          when a single strategy is configured.
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
    - `jsonp` - enables JSONP support by setting the value to the query parameter name containing the function name used to wrap the response payload.
      For example, if the value is `'callback'`, a request comes in with `'callback=me'`, and the JSON response is `'{ "a":"b" }'`, the payload will be:
      `'me({ "a":"b" });'`.
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
greater than 1. If the number of expected parts can be anything, then use '*' without a number (matching any number of segments can only be used in the
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

When a route is matched against an incoming request, the route handler is called and passed a reference to the [request](#request-object) object.
The handler method must call [`request.reply()`](#requestreplyresult) or one of its sub-methods to return control back to the router.

Route handler functions can use one of three declaration styles:

No arguments (the `request` object is bound to `this`, decorated by the `reply` interface):

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
not provide any of the [`request.reply`](#requestreplyresult) decorations.

##### Route prerequisites

It is often necessary to perform prerequisite actions before the handler is called (e.g. load required reference data from a database).
The route `pre` option allows defining such pre-handler methods. The methods are called in order, unless a `mode` is specified with value
`'parallel'` in which case, all the parallel methods are executed first, then the rest in order. `pre` can be assigned a mixed array of:

- objects with:
    - `method` - the function to call (or short-hand helper string as described below). The function signature is `function(request, next)` where:
        - `request` - the incoming `request` object.
        - `next` - the function called when the method is done with the signature `function(result)` where:
            - `result` - any return value including an `Error` object (created via `new Error()` or [`Hapi.error`](#hapierror)). If an error
              is returned, that value is sent back to the client and the handler method is not called.
    - `assign` - key name to assign the result of the function to within `request.pre`.
    - `mode` - set the calling order of the function. Available values:
        - `'serial'` - serial methods are executed after all the `'parallel'` methods in the order listed. This is the default value.
        - `'parallel'` - all parallel methods are executed first in parallel before any serial method. The first to return an error response
          will exist the set.
- functions - same as including an object with a single `method` key.
- strings - special short-hand notation for [registered server helpers](#serverhelpername-method-options) using the format 'name(args)'
  (e.g. `'user(params.id)'`) where:
    - 'name' - the helper name. The name is also used as the default value of `assign`.
    - 'args' - the helper arguments (excluding `next`) where each argument is a property of `request`.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

var pre1 = function (request, next) {

    next('Hello');
};

var pre2 = function (request, next) {

    next('World');
};

var pre3 = function (request, next) {

    next(request.pre.m1 + ' ' + request.pre.m2);
};

server.route({
    method: 'GET',
    path: '/',
    config: {
        pre: [
            { method: pre1, assign: 'm1', mode: 'parallel' },
            { method: pre2, assign: 'm2', mode: 'parallel' },
            { method: pre3, assign: 'm3' },
        ],
        handler: function () {

            this.reply(this.pre.m3 + '\n');
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

var handler = function () {

    this.reply('The page was not found').code(404);
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
      added to the response with the provided value.
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

Initializes the server views manager programmatically instead of via the server [`views`](#server.config.views) configuration option.
The `options` object is the same as the server [`views`](#server.config.views) config object.

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
- `options` - required strategy options. Each scheme comes with its own set of required options, in addition to the options sharedby all schemes:
    - `scheme` - (required, except when `implementation` is used) the built-in scheme name. Available values:
        - `'basic'` - [HTTP Basic authentication](#basic-authentication) ([RFC 2617](http://tools.ietf.org/html/rfc2617))
        - `'cookie'` - [cookie authentication](#cookie-authentication)
        - `'hawk'` - [HTTP Hawk authentication](#hawk-authentication) ([Hawk protocol](https://github.com/hueniverse/hawk))
        - `'bewit'` - [URI Bewit (Hawk)](#bewit-authentication) query authentication ([Hawk protocol](https://github.com/hueniverse/hawk))
    - `implementation` -  an object with the **hapi** authentication scheme interface (use the `'hawk'` implementation as template). Cannot be used together with `scheme`.
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
        - `credentials` - a credentials object passed back to the application in `request.auth.credentials`. Typically, `credentials` are only
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
of the cookie content can use it to impersonate its true owner. The `'cookie`' scheme takes the following required options:

- `scheme` - set to `'cookie'`.
- `cookie` - the cookie name. Defaults to `'sid'`.
- `password` - used for Iron cookie encoding.
- `ttl` - sets the cookie expires time in milliseconds. Defaults to single browser session (ends when browser closes).
- `clearInvalid` - if `true`, any authentication cookie that fails validation will be marked as expired in the response and cleared. Defaults to `false`.
- `isSecure` - if `false`, the cookie is allowed to be transmitted over insecure connections which exposes it to attacks. Defaults to `true`.
- `isHttpOnly` - if `false`, the cookie will not include the 'HttpOnly' flag. Defaults to `true`.
- `redirectTo` - optional login URI to redirect unauthenticated requests to. Defaults to no redirection.
- `appendNext` - if `true` and `redirectTo` is `true`, appends the current request path to the query component of the `redirectTo` URI using the
  parameter name `'next'`. Set to a string to use a different parameter name. Defaults to `false`.
- `validateFunc` - an optional session validation function used to validate the content of the session cookie on each request. Used to verify that the
  internal session state is still valid (e.g. user account still exists). The function has the signature `function(session, callback)` where:
    - `session` - is the session object set via `request.auth.session.set()`.
    - `callback` - a callback function with the signature `function(err, isValid, credentials)` where:
        - `err` - an internal error.
        - `isValid` - `true` if the content of the session is valid, otherwise `false`.
        - `credentials` - a credentials object passed back to the application in `request.auth.credentials`. If value is `null` or `undefined`,
          defaults to `session`. If set, will override the current cookie as if `request.auth.session.set()` was called.

When the cookie scheme is enabled on a route, the `request.auth.session` objects is decorated with two methods:

- `set(session)` - sets the current session. Must be called after a successful login to begin the session. `session` must be a non-null object,
  which is set on successful subsequent authentications in `request.auth.credentials`.
- `clear()` - clears the current session. Used to logout a user.

Because this scheme decorates the `request` object with session-specific methods, it cannot be registered more than once.

```javascript
var Hapi = require('hapi');

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

var server = new Hapi.Server('localhost', 8000);

server.auth('session', {
    scheme: 'cookie',
    password: 'secret',
    cookie: 'sid-example',
    redirectTo: '/login'
});

server.route([
    { method: 'GET', path: '/', config: { handler: home, auth: true } },
    { method: '*', path: '/login', config: { handler: login, auth: { mode: 'try' } } },
    { method: 'GET', path: '/logout', config: { handler: logout, auth: true } }
]);

server.start();
```

##### Hawk authentication

[Hawk authentication](https://github.com/hueniverse/hawk) provides a holder-of-key authentication scheme. The scheme supports payload
authentication. The scheme requires the following options:

- `scheme` - set to `'hawk'`.
- `getCredentialsFunc` - credential lookup function with the signature `function(id, callback)` where:
    - `id` - the Hawk credentials identifier.
    - `callback` - the callback function with signature `function(err, credentials)` where:
        - `err` - an internal error.
        - `credentials` - a credentials object passed back to the application in `request.auth.credentials`. Return `null` or `undefined` to
          indicate unknown credentials (which is not considered an error state).
- `hawk` - optional protocol options passed to `Hawk.server.authenticate()`.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server(config);

var credentials = {
    d74s3nz2873n: {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
}

var getCredentials = function (id, callback) {

    return callback(null, credentials[id]);
};

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
        - `credentials` - a credentials object passed back to the application in `request.auth.credentials`. Return `null` or `undefined` to
          indicate unknown credentials (which is not considered an error state).
- `hawk` - optional protocol options passed to `Hawk.server.authenticateBewit()`.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server(config);

var credentials = {
    d74s3nz2873n: {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
}

var getCredentials = function (id, callback) {

    return callback(null, credentials[id]);
};

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

Registers an extension function in one of the available [extension points](#request-lifecycle) where:

- `event` - the event name.
- `method` - a function or an array of functions to be executed at a specified point during request processing. The required extension function signature
  is `function(request, next)` where:
    - `request` - the incoming `request` object.
    - `next` - the callback function the extension method must call to return control over to the router with signature `function(exit)` where:
        - `exit` - optional request processing exit response. If set to a non-falsy value, the request lifecycle process will jump to the
          "send response" step, skipping all other steps in between, and using the `exit` value as the new response. `exit` can be any result
          value accepted by [`request.reply()`](#requestreplyresult).
- `options` - an optional object with the following:
    - `before` - a string or array of strings of plugin names this method must executed before (on the same event). Otherwise, extension methods are executed
      in the order added.
    - `after` - a string or array of strings of plugin names this method must executed before (on the same event). Otherwise, extension methods are executed
      in the order added.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onRequest', function (request, next) {

    // Change all requests to '/test'
    request.setUrl('/test');
    next();
});

var handler = function () {

    this.reply({ status: 'ok' });
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

#### `server.helper(name, method, [options])`

Registers a server helper function. Server helpers are functions registered with the server and used throughout the application as
a common utility. Their advantage is in the ability to configure them to use the built-in cache and shared across multiple request
handlers without having to create a common module.

Helpers are registered via `server.helper(name, method, [options])` where:

- `name` - a unique helper name used to invoke the method via `server.helpers[name]`.
- `method` - the helper function with the signature is `function(arg1, arg2, ..., argn, next)` where:
    - `arg1`, `arg2`, etc. - the helper function arguments.
    - `next` - the function called when the helper is done with the signature `function(result)` where:
        - `result` - any return value including an `Error` object (created via `new Error()` or [`Hapi.error`](#hapierror)).
- `options` - optional configuration:
    - `cache` - cache configuration as described in [**catbox** module documentation](https://github.com/spumko/catbox#policy):
        - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
          together with `expiresAt`.
        - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
          expire. Cannot be used together with `expiresIn`.
        - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`.
        - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
        - `segment` - optional segment name, used to isolate cached items within the cache partition. Defaults to '#name' where 'name' is the
          helper name. When setting segment manually, it must begin with '##'.
    - `generateKey` - a function used to generate a unique key (for caching) from the arguments passed to the helper function
     (with the exception of the last 'next' argument). The server will automatically generate a unique key if the function's
     arguments are all of types `'string'`, `'number'`, or `'boolean'`. However if the helper uses other types of arguments, a
     key generation function must be provided which takes the same arguments as the function and returns a unique string (or
     `null` if no key can be generated). Note that when the `generateKey` method is invoked, the arguments list will include
     the `next` argument which must not be used in calculation of the key.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

// Simple arguments

var add = function (a, b, next) {

    next(a + b);
};

server.helper('sum', add, { cache: { expiresIn: 2000 } });

server.helpers.sum(4, 5, function (result) {

    console.log(result);
});

// Object argument

var addArray = function (array, next) {

    var sum = 0;
    array.forEach(function (item) {

        sum += item;
    });

    next(sum);
};

server.helper('sumObj', addArray, {
    cache: { expiresIn: 2000 },
    generateKey: function (array) {

        return array.join(',');
    }
});

server.helpers.sumObj([5, 6], function (result) {

    console.log(result);
});
```

#### `server.inject(options, callback)`

Injects a request into the server simulating an incoming HTTP request without making an actual socket connection. Injection is useful for
testing purposes as well as for invoking routing logic internally without the overhead or limitations of the network stack. Utilizes the
[**shot**](https://github.com/spumko/shot) module for performing injections, with some additional options and response properties:

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
        - `headers` - an array containing the headers set.
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

var get = function () {

    this.reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: get });

server.inject('/', function (res) {

    console.log(res.result);
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
- `id` - if the event relates to a request, the request id.
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

Each request object have the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Should not be used by plugins which should use `plugins[name]`.
- `auth` - authentication information:
    - `isAuthenticated` - `true` is the request has been successfully authenticated, otherwise `false`.
    - `credentials` - the `credential` object received during the authentication process. The presence of an object does not mean
      successful authentication.
    - `artifacts` - an artifact object received from the authentication strategy and used in authentication-related actions.
    - `session` - an object used by the [`'cookie'` authentication scheme](#cookie-authentication).
- `id` - a unique request identifier.
- `info` - request information:
    - `received` - request reception timestamp.
    - `remoteAddress` - remote client IP address.
    - `remotePort` - remote client port.
    - `referrer` - content of the HTTP 'Referrer' (or 'Referer') header.
    - `host` - content of the HTTP 'Host' header.
- `method` - the request method in lower case (e.g. `'get'`, `'post'`).
- `params` - an object where each key is a path parameter name with matching value as described in [Path parameters](#path-parameters).
- `path` - the request URI's path component.
- `payload` - an object containing the parsed request payload (when the route `payload` option is set to `'parse'`).
- `plugins` - plugin-specific state. Provides a place to store and pass request-level plugin data. The `plugins` is an object where each
  key is a plugin name and the value is the state.
- `pre` - an object where each key is the name assigned by a [route prerequisites](#route-prerequisites) function.
- `query` - an object containing the query parameters.
- `raw` - an object containing the Node HTTP server objects. **Direct interaction with these raw objects is not recommended.**
    - `req` - the `request` object.
    - `res` - the response object.
- `rawPayload` - the raw request payload `Buffer` (except when the route `payload` option is set to `'stream'`).
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

var handler = function () {

    this.log(['test', 'error'], 'Test event');
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

var get = function (request) {

    var dbTail = request.tail('write to database');

    db.save('key', 'value', function () {

        dbTail();
    });

    request.reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: get });

server.on('tail', function (request) {

    console.log('Request completed including db activity');
});
```

#### `request.setState(name, value, [options])`

_Available until immediately after the `'onPreResponse'` extension point methods are called._

Sets a cookie which is sent with the response, where:

- `name` - the cookie name.
- `value` - the cookie value. If no `encoding` is defined, must be a string.
- `options` - optional configuration. If the state was previously registered with the server using [`server.state()`](#serverstatename-options),
  the specified keys in `options` override those same keys in the server definition (but not others).

```javascript
request.setState('preferences', { color: 'blue' }, { encoding: 'base64json' });
```

#### `request.clearState(name)`

_Available until immediately after the `'onPreResponse'` extension point methods are called._

Clears a cookie which sets an expired cookie and sent with the response, where:

- `name` - the cookie name.

```javascript
request.clearState('preferences');
```

#### `request.reply([result])`

_Available only within the handler method and only before one of `request.reply()`, `request.reply.redirection()`, `request.reply.view()`, or
`request.reply.close()` is called._

Concludes the handler activity by returning control over to the router where:

- `result` - an optional response payload.

Returns a [`response`](#response-types) object based on the value of `result`:

- `null`, `undefined`, or empty string `''` - [`Empty`](#empty) response.
- string - [`Text`](#text) response.
- `Buffer` object - [`Buffer`](#buffer) response.
- `Error` object (generated via [`error`](#hapierror) or `new Error()`) - [`Boom`](#hapierror) object.
- `Stream` object - [`Stream`](#stream) response.
- any other object - [`Obj`](#obj) response.

```javascript
var handler = function () {

    this.reply('success');
};
```

The returned `response` object provides a set of methods to customize the response (e.g. HTTP status code, custom headers, etc.). The methods
are response-type-specific and listed in [`response`](#response-types).

```javascript
var handler = function () {

    this.reply('success')
        .type('text/plain)
        .header('X-Custom', 'some-value');
};
```

The [response flow control rules](#flow-control) apply.

##### `request.reply.redirect(uri)`

_Available only within the handler method and only before one of `request.reply()`, `request.reply.redirection()`, `request.reply.view()`, or
`request.reply.close()` is called._

Concludes the handler activity by returning control over to the router with a redirection response where:

- `uri` - an absolute or relative URI used to redirect the client to another resource. If a relative URI is provided, the value of
  the server [`location`](#server.config.location) configuration option is used as prefix.

Returns a [`Redirection`](#redirection) response.

```javascript
var handler = function () {

    this.reply.redirection('http://example.com/elsewhere')
              .message('You are being redirected...')
              .permanent();
};
```

The [response flow control rules](#flow-control) apply.

##### `request.reply.view(template, [context, [options]])`

_Available only within the handler method and only before one of `request.reply()`, `request.reply.redirection()`, `request.reply.view()`, or
`request.reply.close()` is called._

Concludes the handler activity by returning control over to the router with a templatized view response where:

- `template` - the template filename and path, relative to the templates path configured via the server [`views.path`](#server.config.views).
- `context` - optional object used by the template to render context-specific result. Defaults to no context `{}`.
- `options` - optional object used to override the server's [`views`](#server.config.views) configuration for this response.

Returns a [`View`](#view) response.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({
    views: {
        engines: { html: 'handlebars' },
        path: __dirname + '/templates'
    }
});

var handler = function () {

    var context = {
        title: 'Views Example',
        message: 'Hello, World'
    };

    this.reply.view('hello', context);
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

The [response flow control rules](#flow-control) apply.

##### `request.reply.close()`

_Available only within the handler method and only before one of `request.reply()`, `request.reply.redirection()`, `request.reply.view()`, or
`request.reply.close()` is called._

Concludes the handler activity by returning control over to the router and informing the router that a response has already been sent back
directly via `request.raw.res` and that no further response action is needed (the router will ensure the `request.raw.res` was ended).

No return value.

The [response flow control rules](#flow-control) **do not** apply.

#### `request.generateView(template, context, [options])`

_Always available._

Returns a [`View`](#view) response object using the request environment where:

- `template` - the template filename and path, relative to the templates path configured via the server [`views.path`](#server.config.views).
- `context` - optional object used by the template to render context-specific result. Defaults to no context `{}`.
- `options` - optional object used to override the server's [`views`](#server.config.views) configuration for this response.

Useful when a view response is required outside of the handler (e.g. used in an extension point method to return an override response).

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({ views: { engines: { html: 'handlebars' } } });

server.ext('onPreResponse', function (request, next) {

    var response = request.response();
    if (!response.isBoom) {
        return next();
    }

    // Replace error with friendly HTML

      var error = response;
      var context = {
          message: (error.response.code === 404 ? 'page not found' : 'something went wrong')
      };

      next(request.generateView('error', context));
});
```

#### `request.response()`

_Available after the handler method concludes and immediately after the `'onPreResponse'` extension point methods._

Returns the response object. The object can be modified but cannot be assigned another object. To replace the response with another
from within an extension point, use `next(response)` to return a different response.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onPostHandler', function (request, next) {

    var response = request.response();
    if (response.variety === 'obj') {
        delete response.raw._id;        // Remove internal key
        response.update();
    }
    next();
});
```

## `Hapi.response`

### Flow control

When calling `request.reply()`, the router waits until `process.nextTick()` to continue processing the request and transmit the response.
This enables making changes to the returned response object before the response is sent. This means the router will resume as soon as the handler
method exists. To suspend this behavior, the returned `response` object includes:

- `response.hold()` - puts the response on hold until `response.send()` is called. Available only after `request.reply()` is called and until
  `response.hold()` is invoked once.
- `response.send()` - resume the response which will be transmitted in the next tick. Available only after `response.hold()` is called and until
  `response.send()` is invoked once.

```javascript
var handler = function () {

    var response = this.reply('success').hold();

    onTimeout(function () {

        response.send();
    }, 1000);
};
```

### Response types

Every response type must include the following properties:

- `variety` - the response type name in lower case (e.g. `'text'`).
- `varieties` - an object where each key has a `true` value and represents a response type name (in lower case) whose functionality is made
  available via the response object (e.g. the `File` response type `varieties` object is `{ generic: true, stream: true, file: true }`).

#### `Generic`

The `Generic` response type is used as the parent prototype for all other response types. It cannot be instantiated directly and is only made available
for deriving other response types. It provides the following methods:

- `code(statusCode)` - sets the HTTP status code where:
    - `statusCode` - the HTTP status code.
- `header(name, value)` - sets an HTTP header where:
    - `name` - the header name.
    - `value` - the header value.
- `type(mimeType)` - sets the HTTP 'Content-Type' header where:
    - `value` - is the mime type. Should only be used to override the built-in default for each response type.
- `created(location)` - sets the HTTP status code to Created (201) and the HTTP 'Location' header where:
    `location` - an absolute or relative URI used as the 'Location' header value. If a relative URI is provided, the value of
      the server [`location`](#server.config.location) configuration option is used as prefix. Not available in the `Redirection`
      response object.
- `encoding(encoding)` - sets the 'Content-Type' HTTP header encoding property where:
    `encoding` - the encoding property value.
- `ttl(msec)` - overrides the default route cache expiration rule for this response instance where:
    - `msec` - the time-to-live value in milliseconds.
- `getTtl()` - returns the time-to-live value if an override has been set, and the request method is 'GET'.
- `state(name, value, [options])` - sets an HTTP cookie as described in [`request.setState()`](#requestsetstatename-value-options).
- `unstate(name)` - clears the HTTP cookie by setting an expired value as described in [`request.clearState()`](#requestclearstatename).

#### `Empty`

An empty response body (content-length of zero bytes). Supports all the methods provided by [`Generic`](#generic).

Generated with:

- `request.reply()` - without any arguments.
- `new Hapi.response.Empty()`

```javascript
var handler1 = function () {

    this.reply();
};

var handler2 = function () {

    var response = new Hapi.response.Empty();
    this.reply(response);
};
```

#### `Text`

Plain text. The 'Content-Type' header defaults to `'text/html'`. Supports all the methods provided by [`Generic`](#generic) as well as:

- `message(text, [type, [encoding]])` - sets or replace the response text where:
    - `text` - the text content.
    - `type` - the 'Content-Type' HTTP header value. Defaults to `'text/html'`.
    - `encoding` - the 'Content-Type' HTTP header encoding property. Defaults to `'utf-8'`.

Generated with:

- `request.reply(result)` - where:
    - `result` - must be a non-empty string.
- `new Hapi.response.Text(text, [type, [encoding]])` - same as `message()` above.

```javascript
var handler1 = function () {

    this.reply('hello world');
};

var handler2 = function () {

    var response = new Hapi.response.Text('hello world');
    this.reply(response);
};

var handler3 = function () {

    var response = new Hapi.response.Text();
    response.message('hello world');
    this.reply(response);
};
```

#### `Buffer`

Buffer response. Supports all the methods provided by [`Generic`](#generic).

Generated with:

- `request.reply(result)` - where:
    - `result` - must be a `Buffer`.
- `new Hapi.response.Buffer(buffer)` - where:
    - `buffer` - the `Buffer` response.

```javascript
var handler1 = function () {

    var buffer = new Buffer([10, 11, 12, 13]);
    this.reply(buffer);
};

var handler2 = function () {

    var buffer = new Buffer([10, 11, 12, 13]);
    var response = new Hapi.response.Buffer(buffer);
    this.reply(response);
};
```

#### `Stream`

Replies with a stream object, directly piped into the HTTP response. Supports all the methods provided by [`Generic`](#generic) as well as:

- `bytes(length)` - sets the HTTP 'Content-Length' header (to avoid chunked transfer encoding) where:
    - `length` - the header value. Must match the actual payload size.

Generated with:

- `request.reply(result)` - where:
    - `result` - must be a [`Stream.Readable`](http://nodejs.org/api/stream.html#stream_class_stream_readable) or a node 0.8.x `Stream`.
- `new Hapi.response.Stream(stream)` - where:
    - `stream` - the [`Stream.Readable`](http://nodejs.org/api/stream.html#stream_class_stream_readable) or a node 0.8.x `Stream`.

```javascript
var Stream = require('stream');
var Hapi = require('hapi');

var ExampleStream = function () {

    Stream.Readable.call(this);
};

Hapi.utils.inherits(ExampleStream, Stream.Readable);

ExampleStream.prototype._read = function (size) {

    this.push('hello world');
    this.push(null);
};

var handler1 = function () {

    var stream = new ExampleStream();
    this.reply(stream);
};

var handler2 = function () {

    var response = new Hapi.response.Stream(new ExampleStream());
    this.reply(response);
};

var handler3 = function () {

    // Echo back request stream
    this.reply(this.raw.req).bytes(this.raw.req.headers['content-length']);
};
```

#### `Obj`

JavaScript object, sent stringified. The 'Content-Type' header defaults to 'application/json'. Supports all the methods provided by
[`Generic`](#generic) as well as:

- `raw` - the unmodified, unstringified object. Any direct manipulation must be followed with `update()`.
- `update(type, encoding)` - updates the string representation of the object response after changes to `raw` where:
    - `type` - the 'Content-Type' HTTP header value. Defaults to `'text/html'`.
    - `encoding` - the 'Content-Type' HTTP header encoding property. Defaults to `'utf-8'`.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();

server.ext('onPostHandler', function (request, next) {

    var response = request.response();
    if (response.variety === 'obj') {
        delete response.raw._id;        // Remove internal key
        response.update();
    }
    next();
});
```

Generated with:

- `request.reply(result)` - where:
    - `result` - must be an object.
- `new Hapi.response.Obj(object, [type, [encoding]])` - where:
    - `object` - the response object.
    - `type` - the 'Content-Type' HTTP header value. Defaults to `'text/html'`.
    - `encoding` - the 'Content-Type' HTTP header encoding property. Defaults to `'utf-8'`.

```javascript
var handler1 = function () {

    this.reply({ message: 'hello world' });
};

var handler2 = function () {

    var response = new Hapi.response.Obj({ message: 'hello world' });
    this.reply(response);
};
```

#### `File`

Transmits a file from the file system. The 'Content-Type' header defaults to the matching mime type based on filename extension. Supports all the methods
provided by [`Stream`](#stream).

Generated with:

- `new Hapi.response.File(filePath, [options])` - where:
    - `filePath` - a relative or absolute file path string (relative paths are resolved based on the server [`files`](#server.config.files) configuration).
    - `options` - optional configuration:
        - `mode` - value of the HTTP 'Content-Disposition' header. Allowed values:
            - `'attachment'`
            - `'inline'`
- the built-in route [`file`](#route.config.file) handler.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({ files: { relativeTo: 'routes' } });

var handler1 = function () {

    var response = new Hapi.response.File('./hello.txt');
    this.reply(response);
};

server.route({ method: 'GET', path: '/1', handler: handler1 });

server.route({ method: 'GET', path: '/2', handler: { file: './hello.txt' } });
```

#### `Directory`

Transmits a file or list of files from the file system. The 'Content-Type' header defaults to the matching mime type based on filename
extension. This is an internal response time that can only be accessed via the built-in route handler.

Generated with:

- the built-in route [`directory`](#route.config.directory) handler.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({ files: { relativeTo: 'cwd' } });

var handler1 = {
    directory: {
        path: ['./public1/', './public2/'],
        listing: true
    }
};

var handler2 = {
    directory: {
        path: function (request) {

            return (isMobileDevice(request) ? './mobile' : './public');
        }
    }
};

server.route({ method: 'GET', path: '/1/{path*}', handler: handler1 });
server.route({ method: 'GET', path: '/2/{path*}', handler: handler2 });
```

#### `Redirection`

An HTTP redirection response (3xx). Supports all the methods provided by [`Text`](#text) (except for `created()`) as well as the additional methods:

- `uri(dest)` - set the destination URI where:
    - `uri` - overrides the destination. An absolute or relative URI used as the 'Location' header value. If a relative URI is provided, the
      value of the server [`location`](#server.config.location) configuration option is used as prefix.
- `temporary(isTemporary)` - sets the status code to `302` or `307` (based on the `rewritable()` setting) where:
    - `isTemporary` - if `false`, sets status to permanent. Defaults to `true`.
- `permanent(isPermanent)` - sets the status code to `301` or `308` (based on the `rewritable()` setting) where:
    - `isPermanent` - if `true`, sets status to temporary. Defaults to `false`.
- `rewritable(isRewritable)` - sets the status code to `301`/`302` for rewritable (allows changing the request method from 'POST' to 'GET') or
  `307`/`308` for non-rewritable (does not allow changing the request method from 'POST' to 'GET'). Exact code based on the `temporary()` or
  `permanent()` setting. Arguments:
    - `isRewritable` - if `false`, sets to non-rewritable. Defaults to `true`.

|                |  Permanent   | Temporary |
| -------------- | ---------- | --------- |
| Rewritable     | 301        | **302**(1)|
| Non-rewritable | 308(2)     | 307       |

Notes:
1. Default value.
2. [Proposed code](http://tools.ietf.org/id/draft-reschke-http-status-308-07.txt), not supported by all clients.

Generated with:

- `request.reply.redirect(uri)` - as described in [`request.reply.redirect()`](#requestreplyredirecturi).
- `new Hapi.response.Redirection(uri, [message, [type, [encoding]]])` - where:
    - `uri` - an absolute or relative URI used as the 'Location' header value. If a relative URI is provided, the value of
      the server [`location`](#server.config.location) configuration option is used as prefix.
    - `message` - the payload content. Defaults to `'You are being redirected...'`.
    - `type` - the 'Content-Type' HTTP header value. Defaults to `'text/html'`.
    - `encoding` - the 'Content-Type' HTTP header encoding property. Defaults to `'utf-8'`.

```javascript
var handler1 = function () {

    this.reply.redirect('http://example.com/elsewhere')
              .temporary().rewritable(false);   // 307
};

var handler2 = function () {

    var response = new Hapi.response.Redirection('http://example.com/elsewhere');
    response.permanent().rewritable();          // 301
    this.reply(response);
};
```

#### `View`

Template-based response. Supports all the methods provided by [`Generic`](#generic).

Generated with:

- `request.reply.view(template, [context, [options]])` - as described in [`request.reply.view()`](#requestreplyviewtemplate-context-options).
- `request.generateView(template, context, [options])` - as described in [`request.generateView()`](#requestgenerateviewtemplate-context-options).
- the built-in route [`view`](#route.config.view) handler.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({
    views: {
        engines: { html: 'handlebars' },
        path: __dirname + '/templates'
    }
});

var handler1 = function () {

    var context = {
        params: {
            user: this.params.user
        }
    };

    this.reply.view('hello', context);
};

var handler2 = function () {

    var context = {
        params: {
            user: this.params.user
        }
    };

    this.reply(this.generateView('hello', context));
};

server.route({ method: 'GET', path: '/1/{user}', handler: handler1 });
server.route({ method: 'GET', path: '/2/{user}', handler: handler2 });
server.route({ method: 'GET', path: '/3/{user}', handler: { view: 'hello' } });
```

**templates/hello.html**

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Hello World</title>
    </head>
    <body>
        <div>
            <h1>About {{ params.user }}</h1>
        </div>
    </body>
</html>
```

#### `Cacheable`

The `Cacheable` response type is used as the parent prototype for all cacheable response types. It cannot be instantiated directly and
is only made available for deriving other response types.

## `Hapi.error`

Provides a set of utilities for returning HTTP errors. An alias of the [**boom**](https://github.com/spumko/boom) module (can be also accessed
`Hapi.boom`). Each utility returns a `Boom` error response object (instance of `Error`) which includes the following properties:

- `isBoom` - if `true`, indicates this is a `Boom` object instance.
- `message` - the error message.
- `response` - the formatted response. Can be directly manipulated after object construction to return a custom error response. Allowed root keys:
    - `code` - the HTTP status code (typically 4xx or 5xx).
    - `headers` - an object containing any HTTP headers where each key is a header name and value is the header content.
    - `type` - a mime-type used as the content of the HTTP 'Content-Type' header (overrides `headers['Content-Type']` if present in both).
    - `payload` - the formatted object used as the response payload (stringified). Can be directly manipulated but any changes will be lost
      if `reformat()` is called. Any content allowed and by default includes the following content:
        - `code` - the HTTP status code, derived from `error.response.code`.
        - `error` - the HTTP status message (e.g. 'Bad Request', 'Internal Server Error') derived from `code`.
        - `message` - the error message derived from `error.message`.
- inherited `Error` properties.

It also supports the following method:

- `reformat()` - rebuilds `error.response` using the other object properties.

```javascript
var Hapi = require('hapi');

var handler = function () {

    var error = Hapi.error.badRequest('Cannot feed after midnight');
    error.response.code = 499;    // Assign a custom error code
    error.reformat();

    this.reply(error);
});
```

### Error transformation

Error responses return a JSON object with the `code`, `error`, and `message` keys. When a different error representation is desired, such
as an HTML page or using another format, the `'onPreResponse'` extension point may be used to identify errors and replace them with a different
response object.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server({ views: { engines: { html: 'handlebars' } } });

server.ext('onPreResponse', function (request, next) {

    var response = request.response();
    if (!response.isBoom) {
        return next();
    }

    // Replace error with friendly HTML

      var error = response;
      var context = {
          message: (error.response.code === 404 ? 'page not found' : 'something went wrong')
      };

      next(request.generateView('error', context));
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
- `data` - optional data used for error logging. Typically set to the `Error` object causing the failure.

The returned error object includes the following additional properties:

- `data` - the `data` object provided.
- `trace` - the call stack leading to this error. If `data` is an `Error` object, `trace` is set to `data.trace`.
- `outterTrace` - If `data` is an `Error` object, set to the call stack leading to this error, otherwise `null`.

Note that the `error.response.payload.message` is overridden with `'An internal server error occurred'` to hide any internal details from
the client. `error.message` remains unchanged.

```javascript
var Hapi = require('hapi');

var handler = function () {

    var result;
    try {
        result = JSON.parse(request.query.value);
    }
    catch (err) {
        result = Hapi.error.internal('Failed parsing JSON input', err);
    }

    this.reply(result);
};
```

#### `passThrough(code, payload, contentType, headers)`

Returns a custom HTTP error response object where:

- `code` - the HTTP status code (typically 4xx or 5xx).
- `payload` - the error payload string or `Buffer`.
- `contentType` - a mime-type used as the content of the HTTP 'Content-Type' header (overrides `headers['Content-Type']` if present in both).
- `headers` - an object containing any HTTP headers where each key is a header name and value is the header content.

Used to pass-through errors received from upstream services (proxied) when a response should be treated internally as an error but contain
custom properties.

```javascript
var Hapi = require('hapi');
Hapi.error.passThrough(404, '<h1>Not Found</h1>', 'text/html', { 'Cache-Control': 'no-cache' });
```

## `Hapi.Pack`

`Pack` is a collection of servers grouped together to form a single logical unit. The pack's primary purpose is to provide a unified object
interface when working with [plugins](#plugin-interface). Grouping multiple servers into a single pack enables treating them as a single
entity which can start and stop in sync, as well as enable sharing routes and other facilities.

The servers in a pack share the same cache. Every server belongs to a pack, even if created directed via
[`new Server()`](#new-serverhost-port-options), in which case the `server.pack` object is automatically assigned a single-server pack.

#### `new Pack([options])`

Creates a new `Pack` object instance where:

- `options` - optional configuration:
    - `app` - an object used to initialize the application-specific data stored in `pack.app`.
    - `cache` - cache configuration as described in the server [`cache`](#server.config.cache) option.
    - `requirePath` - sets the path from which node module plugins are loaded. Applies only when using `pack.require()`[#packrequirename-options-callback]
      with module names that do no include a relative or absolute path (e.g. 'lout'). Defaults to the node module behaviour described in
      [node modules](http://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders). Note that if the modules
      are located inside a 'node_modules' sub-directory, `requirePath` must end with `'/node_modules'`.

```javascript
var Hapi = require('hapi');
var pack = new Hapi.Pack();
```

### `Pack` properties

Each `Pack` object instance has the following properties:

- `app` - application-specific state. Provides a safe place to store application data without potential conflicts with **hapi**.
  Initialized via the pack `app` configuration option. Defaults to `{}`.
- `events` - an `Events.EventEmitter` providing a consolidate emitter of all the events emitted from all member pack servers.
- `list` - an object listing all the registered plugins where each key is a plugin name and the value is an object with:
    - `name` - plugin name.
    - `version` - plugin version.
    - `path` - the plugin root path (where 'package.json' is located).
    - `register()` - the [`exports.register()`](#exportsregisterplugin-options-next) function.

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

#### `pack.allow(permissions)`

Overrides the default plugin permissions when [requiring](#packrequirename-options-callback) or [registering](#packregisterplugin-options-callback)
a plugin. Where:

- `permissions` - an object where each key is a permission name and the value is a boolean set to `true` (allow) or `false` (deny) access.

Returns a plugin registration interface with the `pack.require()` and `pack.register()` methods.

The default permissions are:

- `auth` - allows registering an authentication strategy via [`plugin.auth()`](#pluginauthname-options). Defaults to `true`.
- `cache` - allows provisioning a plugin cache segment via [`plugin.cache()`](#plugincacheoptions). Defaults to `true`.
- `events` - allows access to events via [`plugin.events`](#pluginevents). Defaults to `true`.
- `ext`- allows registering extension methods via [`plugin.ext()`](#pluginextevent-method-options). Defaults to `false`.
- `helper` - allows addming server helper methods via [`plugin.helper()`](#pluginhelpername-method-options). Defaults to `true`.
- `route` - allows adding routes via [`plugin.route()`](#pluginrouteoptions). Defaults to `true`.
- `state` - allows configuring state definitions via [`plugin.state()`](#pluginstatename-options). Defaults to `true`.
- `views` - allows configuring a plugin-specific views manager via [`plugin.views()`](#pluginviewsoptions). Defaults to `true`.

```javascript
var Hapi = require('hapi');
var pack = new Hapi.Pack();

pack.server(8000, { labels: ['web'] });
pack.server(8001, { labels: ['admin'] });

pack.allow({ ext: true }).require('yar', function (err) {

    if (err) {
        console.log('Failed loading plugin: yar');
    }
});
```

#### `pack.require(name, [options], callback)`

Registers a plugin where:

- `name` - the node module name as expected by node's [`require()`](http://nodejs.org/api/modules.html#modules_module_require_id). If `name` is a relative
  path it is relative to the location of the file requiring it. If `name` is not a relative or absolute path (e.g. 'furball'), it is prefixed with the
  value of the pack `requirePath` configuration option when present.
- `options` - optional configuration object which is passed to the plugin via the `options` argument in
  [`exports.register()`](#exportsregisterplugin-options-next). If `options` is an array, the first array item is used as [`permissions`](#packallowpermissions),
  and the second item is used as `options`.
- `callback` - the callback function with signature `function(err)` where:
      - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, missing permissions, or namespace conflicts
        (e.g. among routes, helpers, state) will throw an error and will not return a callback.

```javascript
pack.require('furball', { version: '/v' }, function (err) {

    if (err) {
        console.log('Failed loading plugin: furball');
    }
});
```

#### `pack.require(names, callback)`

Registers a list of plugins where:

- `names` - an array of plugins names as described in [`pack.require()`](#packrequirename-options-callback), or an object in which
  each key is a plugin name, and each value is the `options` object used to register that plugin. If the `options` value is an array,
  the first array item is used as [`permissions`](#packallowpermissions), and the second item is used as `options`.
- `callback` - the callback function with signature `function(err)` where:
      - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, missing permissions, or namespace conflicts
        (e.g. among routes, helpers, state) will throw an error and will not return a callback.

Batch registration is required when plugins declare a [dependency](#plugindependencydeps), so that all the required dependencies are loaded in
a single transaction (internal order does not matter).

```javascript
pack.require(['furball', 'lout'], function (err) {

    if (err) {
        console.log('Failed loading plugin: furball');
    }
});

pack.require({ furball: null, lout: { endpoint: '/docs' } }, function (err) {

    if (err) {
        console.log('Failed loading plugins');
    }
});
```

#### `pack.register(plugin, options, callback)`

Registers a plugin object (without using `require()`) where:

- `plugin` - the plugin object which requires:
    - `name` - plugin name.
    - `version` - plugin version.
    - `path` - optional plugin path for resolving relative paths used by the plugin. Defaults to current working directory.
    - `register()` - the [`exports.register()`](#exportsregisterplugin-options-next) function.
- `options` - optional configuration object which is passed to the plugin via the `options` argument in
  [`exports.register()`](#exportsregisterplugin-options-next). If `options` is an array, the first array item is used as [`permissions`](#packallowpermissions),
  and the second item is used as `options`.
- `callback` - the callback function with signature `function(err)` where:
    - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, missing permissions, or namespace conflicts
      (e.g. among routes, helpers, state) will throw an error and will not return a callback.

```javascript
var plug = {
    name: 'test',
    version: '2.0.0',
    register: function (plugin, options, next) {

        plugin.route({ method: 'GET', path: '/special', handler: function () { this.reply(options.message); } } );
        next();
    }
};

server.pack.register(plug, { message: 'hello' }, function (err) {

    if (err) {
        console.log('Failed loading plugin');
    }
});
```

## `Hapi.Composer`

The `Composer` provides a simple way to construct a [`Pack`](#hapipack) from a single configuration object, including configuring servers
and registering plugins.

#### `new Composer(manifest)`

Creates a `Composer` object instance where:

- `manifest` - an object or array or objects where:
    - `pack` - the pack `options` as described in [`new Pack()`](#packserverhost-port-options).
    - `servers` - an array of server configuration objects where:
        - `host`, `port`, `options` - the same as described in [`new Server()`](#new-serverhost-port-options) with the exception that the
          `cache` option is not allowed and must be configured via the pack `cache` option. The `host` and `port` keys can be set to an environment variable by prefixing the variable name with `'$env.'`.
    - `plugin` - an object where each key is a plugin name, and each value is the `options` object used to register that plugin. If the `options`
      value is an array, the first array item is used as [`permissions`](#packallowpermissions), and the second item is used as `options`.

```javascript
var Hapi = require('hapi');

var manifest = {
    pack: {
        cache: 'memory'
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
        'yar': [
            {
                ext: true
            },
            {
                cookieOptions: {
                    password: 'secret'
                }
            }
        ]
    }
};

var composer = new Hapi.Composer(manifest);
```

#### `composer.compose(callback)`

Creates the packs described in the manifest construction where:

- `callback` - the callback method, called when all packs and servers have been created and plugins registered has the signature
  `function(err)` where:
    - `err` - an error returned from `exports.register()`. Note that incorrect usage, bad configuration, missing permissions, or namespace conflicts
      (e.g. among routes, helpers, state) will throw an error and will not return a callback.

```javascript
composer.compose(function (err) {

    if (err) {
        console.log('Failed composing');
    }
});
```

#### `composer.start([callback])`

Starts all the servers in all the pack composed where:

- `callback` - the callback method called when all the servers have been started.

```javascript
composer.start(function () {

    console.log('All servers started');
});
```

#### `composer.stop([options], [callback])`

Stops all the servers in all the packs and used as described in [`server.stop([options], [callback])`](#serverstopoptions-callback).

```javascript
pack.stop({ timeout: 60 * 1000 }, function () {

    console.log('All servers stopped');
});
```

## Plugin interface

Plugins provide an extensibility platform for both general purpose utilities such as [batch requests](https://github.com/spumko/bassmaster) and for
application business logic. Instead of thinking about a web server as a single entity with a unified routing table, plugins enable developers to
break their application into logical units, assembled together in different combinations to fit the development, testing, and deployment needs.

Constructing a plugin requires the following:

- name - the plugin name is used as a unique key. Public plugins should be published in the [npm registry](https://npmjs.org) and derive their name
  from the registry name. This ensures uniqueness. Private plugin names should be picked carefully to avoid conflicts with both private and public
  names. Typically, private plugin names use a prefix such as the company name or an unusual combination of characters (e.g. `'--'`). When using the
  [`pack.require()`](#packrequirename-options-callback) interface, the name is obtained from the 'package.json' module file. When using the
  [`pack.register()`](#packregisterplugin-options-callback) interface, the name is provided as a required key in `plugin`.
- version - the plugin version is only used informatively within the framework but plays an important role in the plugin echo-system. The plugin
  echo-system relies on the [npm peer dependency](http://blog.nodejs.org/2013/02/07/peer-dependencies/) functionality to ensure that plugins can
  specify their dependency on a specific version of **hapi**, as well as on each other. Dependencies are expressed solely within the 'package.json'
  file, and are enforced by **npm**. When using the [`pack.require()`](#packrequirename-options-callback) interface, the version is obtained from
  the 'package.json' module file. When using the [`pack.register()`](#packregisterplugin-options-callback) interface, the version is provided as
  a required key in `plugin`.
- `exports.register()` - the registration function described in [`exports.register()`](#exportsregisterplugin-options-next) is the plugin's core.
  The function is called when the plugin is registered and it performs all the activities required by the plugin to operate. It is the single entry
  point into the plugin functionality. When using the [`pack.require()`](#packrequirename-options-callback) interface, the function is obtained by
  [`require()`](http://nodejs.org/api/modules.html#modules_module_require_id)'ing the plugin module and invoking the exported `register()` method.
  When using the [`pack.register()`](#packregisterplugin-options-callback) interface, the function is provided as a required key in `plugin`.

**package.json**

```json
{
  "name": "furball",
  "description": "Plugin utilities and endpoints",
  "version": "0.3.0",
  "main": "index",
  "dependencies": {
    "hoek": "0.8.x"
  },
  "peerDependencies": {
    "hapi": "1.x.x"
  }
}
```

**index.js**

```javascript
var Hoek = require('hoek');

var internals = {
    defaults: {
        version: '/version',
        plugins: '/plugins'
    }
};

internals.version = Hoek.loadPackage().version;

exports.register = function (plugin, options, next) {

    var settings = Hoek.applyToDefaults(internals.defaults, options);

    if (settings.version) {
        plugin.route({
            method: 'GET',
            path: settings.version,
            handler: function () {

                this.reply(internals.version);
            }
        });
    }

    if (settings.plugins) {
        plugin.route({
            method: 'GET',
            path: settings.plugins,
            handler: function () {

                this.reply(listPlugins(this.server));
            }
        });
    }

    var listPlugins = function (server) {

        var plugins = [];
        Object.keys(server.pack.list).forEach(function (name) {

            var item = server.pack.list[name];
            plugins.push({
                name: item.name,
                version: item.version
            });
        });

        return plugins;
    };

    plugin.api('plugins', listPlugins);
    next();
};
```

#### `exports.register(plugin, options, next)`

Registers the plugin where:

- `plugin` - the registration interface representing the pack the plugin is being registered into. Provides the properties and methods listed below, based
  on the permissions granted.
- `options` - the `options` object provided by the pack registration methods.
- `next` - the callback function the plugin must call to return control over to the application and complete the registration process. The function
  signature is `function(err)` where:
    - `err` - internal plugin error condition, which is returned back via the registration methods' callback. A plugin registration error is considered
      an unrecoverable event which should terminate the application.

```javascript
exports.register = function (plugin, options, next) {

    plugin.route({ method: 'GET', path: '/', handler: function () { this.reply('hello world') } });
    next();
};
```

### Root methods and properties

The plugin interface root methods and properties are those available only on the `plugin` object received via the
[`exports.register()`](#exportsregisterplugin-options-next) interface. They are not available on the object received by calling
[`plugin.select()`](#pluginselectlabels).

#### `plugin.version`

The plugin version information.

```javascript
exports.register = function (plugin, options, next) {

    console.log(plugin.version);
    next();
};
```

#### `plugin.path`

The plugin root path (where 'package.json' resides).

```javascript
var Fs = require('fs');

exports.register = function (plugin, options, next) {

    var file = Fs.readFileSync(plugin.path + '/resources/image.png');
    next();
};
```

#### `plugin.hapi`

A reference to the **hapi** module used to create the pack and server instances. Removes the need to add a dependency on **hapi** within the plugin.

```javascript
exports.register = function (plugin, options, next) {

    var Hapi = plugin.hapi;

    var handler = function () {

        this.reply(Hapi.error.internal('Not implemented yet'));
    };

    plugin.route({ method: 'GET', path: '/', handler: handler });
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

#### `plugin.events`

_Requires the `events` plugin permission._

The `pack.events' emitter.

```javascript
exports.register = function (plugin, options, next) {

    plugin.events.on('internalError', function (request, err) {

        console.log(err);
    });

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

#### `plugin.dependency(deps)`

Declares a required dependency upon other plugins where:

- `deps` - a single string or array of strings of plugin names which must be registered in order for this plugin to operate. Plugins listed
  must be registered in the same pack transaction to allow validation of the dependency requirements. Does not provide version dependency which
  should be implemented using [npm peer dependencies](http://blog.nodejs.org/2013/02/07/peer-dependencies/).

```javascript
exports.register = function (plugin, options, next) {

    plugin.dependency('yar');
    next();
};
```

#### `plugin.views(options)`

_Requires the `views` plugin permission._

Generates a plugin-specific views manager for rendering templates where:
- `options` - the views configuration as described in the server's [`views`](#server.config.views) option. Note that due to the way node
  `require()` operates, plugins must require rendering engines directly and pass the engine using the `engines.module` option.

Note that relative paths are relative to the plugin root, not the working directory or the application registering the plugin. This allows
plugin the specify their own static resources without having to require external configuration.

```javascript
exports.register = function (plugin, options, next) {

    plugin.views({
        engines: {
            jade: require('jade')
        },
        path: './templates'
    });

    next();
};
```

#### `plugin.helper(name, method, [options])`

_Requires the `helper` plugin permission._

Registers a server helper function with all the pack's servers as described in [`server.helper()`](#serverhelpername-method-options)

```javascript
exports.register = function (plugin, options, next) {

    plugin.helper('user', function (id, next) {

        next({ id: id });
    });

    next();
};
```

#### `plugin.cache(options)`

_Requires the `cache` plugin permission._

Provisions a plugin cache segment within the pack's common caching facility where:

- `options` - cache configuration as described in [**catbox** module documentation](https://github.com/spumko/catbox#policy):
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
      together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route
      expire. Cannot be used together with `expiresIn`.
    - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it. Must be less than `expiresIn`.
    - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
    - `segment` - optional segment name, used to isolate cached items within the cache partition. Defaults to '!name' where 'name' is the
      plugin name. When setting segment manually, it must begin with '!!'.

```javascript
exports.register = function (plugin, options, next) {

    var cache = plugin.cache({ expiresIn: 60 * 60 * 1000 });
    next();
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
    selection.route({ method: 'GET', path: '/', handler: 'notfound' });
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

#### `plugin.api(key, value)`

Adds an plugin API to the `server.plugins[name]` ('name' of plugin) object of each selected pack server where:

- `key` - the key assigned (`server.plugins[name][key]`).
- `value` - the value assigned.

```javascript
exports.register = function (plugin, options, next) {

    plugin.api('util', function () { console.log('something'); });
    next();
};
```

#### `plugin.api(obj)`

Merges a deep copy of an object into to the existing content of the `server.plugins[name]` ('name' of plugin) object of each
selected pack server where:

- `obj` - the object merged into the API container.

```javascript
exports.register = function (plugin, options, next) {

    plugin.api({ util: function () { console.log('something'); } });
    next();
};
```

#### `plugin.route(options)`

_Requires the `route` plugin permission._

Adds a server route to the selected pack's servers as described in [`server.route(options)`](#serverrouteoptions).

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('web');
    selection.route({ method: 'GET', path: '/', handler: 'notfound' });
    next();
};
```

#### `plugin.route(routes)`

_Requires the `route` plugin permission._

Adds multiple server routes to the selected pack's servers as described in [`server.route(routes)`](#serverrouteroutes).

```javascript
exports.register = function (plugin, options, next) {

    var selection = plugin.select('admin');
    selection.routes([
        { method: 'GET', path: '/1', handler: 'notfound' },
        { method: 'GET', path: '/2', handler: 'notfound' }
    ]);

    next();
};
```

#### `plugin.state(name, [options])`

_Requires the `state` plugin permission._

Adds a state definition to the selected pack's servers as described in [`server.state()`](#serverstatename-options).

```javascript
exports.register = function (plugin, options, next) {

    plugin.state('example', { encoding: 'base64' });
    next();
};
```

#### `plugin.auth(name, options)`

_Requires the `auth` plugin permission._

Adds an authentication strategy to the selected pack's servers as described in [`server.auth()`](#serverauthname-options).

```javascript
exports.register = function (plugin, options, next) {

    plugin.auth('simple', {
        scheme: 'basic',
        validateFunc: function (username, password, callback) {

            callback(new Error('User not found'));
        }
    });

    next();
};
```

#### `plugin.ext(event, method, [options])`

_Requires the `ext` plugin permission._

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

## `Hapi.utils`

An alias of the [**hoek**](https://github.com/spumko/hoek) module.

#### `version()`

Returns the **hapi** module version number.

```javascript
var Hapi = require('hapi');
console.log(Hapi.utils.version());
```

## `Hapi.types`

See [**joi** Types](https://github.com/spumko/joi#type-registry).

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

var handler = function (request) {

    var maxCookieSize = 512;

    var cookieOptions = {
        encoding: 'iron',
        password: 'secret'
    };

    var content = request.pre.user;

    Hapi.state.prepareValue('user', content, cookieOptions, function (err, value) {

        if (err) {
            return request.reply(err);
        }

        if (value.length < maxCookieSize) {
            request.setState('user', value, { encoding: 'none' } );   // Already encoded
        }

        request.reply('success');
    });
};
```

