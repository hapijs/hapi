
## Server

The server object is the main application container. The server manages all incoming requests
along with all the facilities provided by the framework. Each server supports a single connection
(e.g. listen to port `80`).

### <a name="server()" /> `server([options])`

Creates a new server object where:
- `options` - (optional) a [server configuration object](#server.options).

```js
const Hapi = require('@hapi/hapi');

const server = Hapi.server({ load: { sampleInterval: 1000 } });
```

### <a name="server.options" /> Server options

The server options control the behavior of the server object. Note that the options object is
deeply cloned (with the exception of [`listener`](#server.options.listener) which is shallowly
copied) and should not contain any values that are unsafe to perform deep copy on.

All options are optionals.

#### <a name="server.options.address" /> `server.options.address`

Default value: `'0.0.0.0'` (all available network interfaces).

Sets the hostname or IP address the server will listen on. If not configured, defaults to
[`host`](#server.options.host) if present, otherwise to all available network interfaces. Set to
`'127.0.0.1'` or `'localhost'` to restrict the server to only those coming from the same host.

#### <a name="server.options.app" /> `server.options.app`

Default value: `{}`.

Provides application-specific configuration which can later be accessed via
[`server.settings.app`](#server.settings). The framework does not interact with this object. It is
simply a reference made available anywhere a `server` reference is provided.

Note the difference between `server.settings.app` which is used to store static configuration
values and [`server.app`](#server.app) which is meant for storing run-time state.

#### <a name="server.options.autolisten" /> `server.options.autoListen`

Default value: `true`.

Used to disable the automatic initialization of the [`listener`](#server.options.listener). When
`false`, indicates that the [`listener`](#server.options.listener) will be started manually outside
the framework.

Cannot be set to `false` along with a [`port`](#server.options.port) value.

#### <a name="server.options.cache" /> `server.options.cache`

Default value: `{ provider: { constructor: require('@hapi/catbox-memory'), options: { partition: 'hapi-cache' } } }`.

Sets up server-side caching providers. Every server includes a default cache for storing
application state. By default, a simple memory-based cache is created which has limited capacity
and capabilities.

**hapi** uses [**catbox**](https://hapi.dev/family/catbox/api) for its cache implementation which
includes support for common storage solutions (e.g. Redis, MongoDB, Memcached, Riak, among others).
Caching is only utilized if [methods](#server.methods) and [plugins](#plugins) explicitly store
their state in the cache.

The server cache configuration only defines the storage container itself. The configuration can be
assigned one or more (array):

- a class or prototype function (usually obtained by calling `require()` on a **catbox** strategy
    such as `require('@hapi/catbox-redis')`). A new **catbox** [client](https://hapi.dev/family/catbox/api#client)
    will be created internally using this constructor.

- a configuration object with the following:

    - `engine` - a **catbox** engine object instance.

    - `name` - an identifier used later when provisioning or configuring caching for
        [server methods](#server.methods) or [plugins](#plugins). Each cache name must be unique.
        A single item may omit the `name` option which defines the default cache. If every cache
        includes a `name`, a default memory cache is provisioned as well.

    - `provider` - a class, a constructor function, or an object with the following:

        - `constructor` - a class or a prototype function.

        - `options` - (optional) a settings object passed as-is to the `constructor` with the following:

            - `partition` - (optional) string used to isolate cached data. Defaults to `'hapi-cache'`.
            - other constructor-specific options passed to the `constructor` on instantiation.

    - `shared` - if `true`, allows multiple cache users to share the same segment (e.g.
        multiple methods using the same cache storage container). Default to `false`.

    - One (and only one) of `engine` or `provider` is required per configuration object.

#### <a name="server.options.compression" /> `server.options.compression`

Default value: `{ minBytes: 1024 }`.

Defines server handling of content encoding requests. If `false`, response content encoding is
disabled and no compression is performed by the server.

##### <a name="server.options.compression.minBytes" /> `server.options.compression.minBytes`

Default value: '1024'.

Sets the minimum response payload size in bytes that is required for content encoding compression.
If the payload size is under the limit, no compression is performed.

#### <a name="server.options.debug" /> `server.options.debug`

Default value: `{ request: ['implementation'] }`.

Determines which logged events are sent to the console. This should only be used for development
and does not affect which events are actually logged internally and recorded. Set to `false` to
disable all console logging, or to an object with:

- `log` - a string array of server log tags to be displayed via `console.error()` when
    the events are logged via [`server.log()`](#server.log()) as well as
    internally generated [server logs](#server-logs). Defaults to no output.

- `request` - a string array of request log tags to be displayed via `console.error()` when
    the events are logged via [`request.log()`](#request.log()) as well as
    internally generated [request logs](#request-logs). For example, to display all errors,
    set the option to `['error']`. To turn off all console debug messages set it to `false`.
    To display all request logs, set it to `'*'`.
    Defaults to uncaught errors thrown in external code (these errors are handled
    automatically and result in an Internal Server Error response) or runtime errors due to
    developer error.

For example, to display all errors, set the `log` or `request` to `['error']`. To turn off all
output set the `log` or `request` to `false`. To display all server logs, set the `log` or
`request` to `'*'`. To disable all debug information, set `debug` to `false`.

#### <a name="server.options.host" /> `server.options.host`

Default value: the operating system hostname and if not available, to `'localhost'`.

The public hostname or IP address. Used to set [`server.info.host`](#server.info) and
[`server.info.uri`](#server.info) and as [`address`](#server.options.address) if none is provided.

#### <a name="server.options.info.remote" /> `server.options.info.remote`

Default value: `false`.

If `true`, the `request.info.remoteAddress` and `request.info.remotePort` are populated when the request is received which can consume more resource (but is ok if the information is needed, especially for aborted requests). When `false`, the fields are only populated upon demand (but will be `undefined` if accessed after the request is aborted).

#### <a name="server.options.listener" /> `server.options.listener`

Default value: none.

An optional node HTTP (or HTTPS) [`http.Server`](https://nodejs.org/api/http.html#http_class_http_server)
object (or an object with a compatible interface).

If the `listener` needs to be manually started, set [`autoListen`](#server.options.autolisten) to
`false`.

If the `listener` uses TLS, set [`tls`](#server.options.tls) to `true`.

#### <a name="server.options.load" /> `server.options.load`

Default value: `{ sampleInterval: 0 }`.

Server excessive load handling limits where:

- `sampleInterval` - the frequency of sampling in milliseconds. When set to `0`, the other load options are ignored. Defaults to `0` (no sampling).

- `maxHeapUsedBytes` - maximum V8 heap size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).

- `maxRssBytes` - maximum process RSS size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).

- `maxEventLoopDelay` - maximum event loop delay duration in milliseconds over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).

#### <a name="server.options.mime" /> `server.options.mime`

Default value: none.

Options passed to the [**mimos**](https://hapi.dev/family/mimos/api) module when generating the mime database used by the server (and accessed via [`server.mime`](#server.mime)):

- `override` - an object hash that is merged into the built in mime information specified [here](https://github.com/jshttp/mime-db). Each key value pair represents a single mime object. Each override value must contain:

    - `key` - the lower-cased mime-type string (e.g. `'application/javascript'`).

    - `value` - an object following the specifications outlined [here](https://github.com/jshttp/mime-db#data-structure). Additional values include:

        - `type` - specify the `type` value of result objects, defaults to `key`.

        - `predicate` - method with signature `function(mime)` when this mime type is found in the database, this function will execute to allows customizations.

```js
const options = {
    mime: {
        override: {
            'node/module': {
                source: 'iana',
                compressible: true,
                extensions: ['node', 'module', 'npm'],
                type: 'node/module'
            },
            'application/javascript': {
                source: 'iana',
                charset: 'UTF-8',
                compressible: true,
                extensions: ['js', 'javascript'],
                type: 'text/javascript'
            },
            'text/html': {
                predicate: function(mime) {
                    if (someCondition) {
                        mime.foo = 'test';
                    }
                    else {
                        mime.foo = 'bar';
                    }
                    return mime;
                }
            }
        }
    }
};
```

#### <a name="server.options.operations" /> `server.options.operations`

Default value: `{ cleanStop: true }`.

Defines server handling of server operations:

- `cleanStop` - if `true`, the server keeps track of open connections and properly closes them
  when the server is stopped. Under normal load, this should not interfere with server performance.
  However, under severe load connection monitoring can consume additional resources and aggravate
  the situation. If the server is never stopped, or if it is forced to stop without waiting for
  open connection to close, setting this to `false` can save resources that are not being utilized
  anyway. Defaults to `true`.

#### <a name="server.options.plugins" /> `server.options.plugins`

Default value: `{}`.

Plugin-specific configuration which can later be accessed via [`server.settings.plugins`](#server.settings).
`plugins` is an object where each key is a plugin name and the value is the configuration.
Note the difference between [`server.settings.plugins`](#server.settings) which is used to store
static configuration values and [`server.plugins`](#server.plugins) which is meant for storing
run-time state.

#### <a name="server.options.port" /> `server.options.port`

Default value: `0` (an ephemeral port).

The TCP port the server will listen to. Defaults the next available port when the server is started
(and assigned to [`server.info.port`](#server.info)).

If `port` is a string containing a '/' character, it is used as a UNIX domain socket path.
If it starts with '\\.\pipe', it is used as a Windows named pipe.

#### <a name="server.options.query" /> `server.options.query`

Default value: `{}`.

Defines server handling of the request path query component.

##### <a name="server.options.query.parser" /> `server.options.query.parser`

Default value: none.

Sets a query parameters parser method using the signature `function(query)` where:

- `query` - an object containing the incoming [`request.query`](#request.query) parameters.
- the method must return an object where each key is a parameter and matching value is the
  parameter value. If the method throws, the error is used as the response or returned when
  [`request.setUrl()`](#request.setUrl()) is called.

```js
const Qs = require('qs');

const options = {
    query: {
        parser: (query) => Qs.parse(query)
    }
};
```

#### <a name="server.options.router" /> `server.options.router`

Default value: `{ isCaseSensitive: true, stripTrailingSlash: false }`.

Controls how incoming request URIs are matched against the routing table:

- `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered
  different resources. Defaults to `true`.

- `stripTrailingSlash` - removes trailing slashes on incoming paths. Defaults to `false`.

#### <a name="server.options.routes" /> `server.options.routes`

Default value: none.

A [route options](#route-options) object used as the default configuration for every route.

#### <a name="server.options.state" /> `server.options.state`

Default value:
```js
{
    strictHeader: true,
    ignoreErrors: false,
    isSecure: true,
    isHttpOnly: true,
    isSameSite: 'Strict',
    encoding: 'none'
}
```

Sets the default configuration for every state (cookie) set explicitly via
[`server.state()`](#server.state()) or implicitly (without definition) using the
[state configuration](#server.state()) object.

#### <a name="server.options.tls" /> `server.options.tls`

Default value: none.

Used to create an HTTPS connection. The `tls` object is passed unchanged to the node
HTTPS server as described in the [node HTTPS documentation](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

Set to `true` when passing a [`listener`](#server.options.listener) object that has been configured
to use TLS directly.

#### <a name="server.options.uri" /> `server.options.uri`

Default value: constructed from runtime server information.

The full public URI without the path (e.g. 'http://example.com:8080'). If present, used as the
server [`server.info.uri`](#server.info), otherwise constructed from the server settings.

### Server properties

#### <a name="server.app" /> `server.app`

Access: read / write.

Provides a safe place to store server-specific run-time application data without potential
conflicts with the framework internals. The data can be accessed whenever the server is
accessible. Initialized with an empty object.

```js
const server = Hapi.server();

server.app.key = 'value';

const handler = function (request, h) {

    return request.server.app.key;        // 'value'
};
```

#### <a name="server.auth.api" /> `server.auth.api`

Access: authentication strategy specific.

An object where each key is an authentication strategy name and the value is the exposed strategy
API. Available only when the authentication scheme exposes an API by returning an `api` key in the
object returned from its implementation function.

```js
const server = Hapi.server({ port: 80 });

const scheme = function (server, options) {

    return {
        api: {
            settings: {
                x: 5
            }
        },
        authenticate: function (request, h) {

            const authorization = request.headers.authorization;
            if (!authorization) {
                throw Boom.unauthorized(null, 'Custom');
            }

            return h.authenticated({ credentials: { user: 'john' } });
        }
    };
};

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

console.log(server.auth.api.default.settings.x);    // 5
```

#### <a name="server.auth.settings.default" /> `server.auth.settings.default`

Access: read only.

Contains the default authentication configuration if a default strategy was set via
[`server.auth.default()`](#server.auth.default()).

#### <a name="server.decorations" /> `server.decorations`

Access: read only.

Provides access to the decorations already applied to various framework interfaces. The object must
not be modified directly, but only through [`server.decorate`](#server.decorate()).
Contains:

- `request` - decorations on the [request object](#request).
- `response` - decorations on the [response object](#response-object).
- `toolkit` - decorations on the [response toolkit](#response-toolkit).
- `server` - decorations on the [server](#server) object.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const success = function () {

    return this.response({ status: 'ok' });
};

server.decorate('toolkit', 'success', success);
console.log(server.decorations.toolkit);            // ['success']
```

#### <a name="server.events" /> `server.events`

Access: **podium** public interface.

The server events emitter. Utilizes the [**podium**](https://hapi.dev/family/podium/api) with support
for event criteria validation, channels, and filters.

Use the following methods to interact with `server.events`:

- [`server.event(events)`](#server.event()) - register application events.
- [`server.events.emit(criteria, data)`](#server.events.emit()) - emit server events.
- [`server.events.on(criteria, listener)`](#server.events.on()) - subscribe to all events.
- [`server.events.once(criteria, listener)`](#server.events.once()) - subscribe to

Other methods include: `server.events.removeListener(name, listener)`,
`server.events.removeAllListeners(name)`, and `server.events.hasListeners(name)`.

##### <a name="server.events.log" /> `'log'` Event

The `'log'` event type emits internal server events generated by the framework as well as
application events logged with [`server.log()`](#server.log()).

The `'log'` event handler uses the function signature `function(event, tags)` where:

- `event` - an object with the following properties:
    - `timestamp` - the event timestamp.
    - `tags` - an array of tags identifying the event (e.g. `['error', 'http']`).
    - `channel` - set to `'internal'` for internally generated events, otherwise `'app'` for events
      generated by [`server.log()`](#server.log()).
    - `data` - event-specific information. Available when event data was provided and is not an
      error. Errors are passed via `error`.
    - `error` - the error object related to the event if applicable. Cannot appear together with
      `data`.

- `tags` - an object where each `event.tag` is a key and the value is `true`. Useful for quick
  identification of events.

```js
server.events.on('log', (event, tags) => {

    if (tags.error) {
        console.log(`Server error: ${event.error ? event.error.message : 'unknown'}`);
    }
});
```

The internally generated events are (identified by their `tags`):

- `load` - logs the current server load measurements when the server rejects a request due to
  [high load](#server.options.load). The event data contains the process load metrics.

- `connection` `client` `error` - a `clientError` event was received from the HTTP or HTTPS
  listener. The event data is the error object received.

##### <a name="server.events.cachePolicy" /> `'cachePolicy'` Event

The `'cachePolicy'` event type is emitted when a server [cache policy](https://hapi.dev/module/catbox/api#policy)
is created via [`server.cache()`](#server.cache()) or a [`server.method()`](#server.method()) with caching enabled is registered.
The `'cachePolicy'` event handler uses the function signature `function(cachePolicy, cache, segment)` where:

- `cachePolicy` - the catbox [cache policy](https://hapi.dev/module/catbox/api#policy).
- `cache` - the [cache provision](#server.options.cache) name used when the policy was created or `undefined` if the default cache was used.
- `segment` - the segment name used when the policy was created.

```js
server.events.on('cachePolicy', (cachePolicy, cache, segment) => {

    console.log(`New cache policy created using cache: ${cache === undefined ? 'default' : cache} and segment: ${segment}`);
});
```

##### <a name="server.events.request" /> `'request'` Event

The `'request'` event type emits internal request events generated by the framework as well as
application events logged with [`request.log()`](#request.log()).

The `'request'` event handler uses the function signature `function(request, event, tags)` where:

- `request` - the [request object](#request).

- `event` - an object with the following properties:
    - `timestamp` - the event timestamp.
    - `tags` - an array of tags identifying the event (e.g. `['error', 'http']`).
    - `channel` - one of
        - `'app'` - events generated by [`server.log()`](#server.log()).
        - `'error'` - emitted once per request if the response had a `500` status code.
        - `'internal'` - internally generated events.
    - `request` - the request [identifier](#request.info.id).
    - `data` - event-specific information. Available when event data was provided and is not an
      error. Errors are passed via `error`.
    - `error` - the error object related to the event if applicable. Cannot appear together with
      `data`.

- `tags` - an object where each `event.tag` is a key and the value is `true`. Useful for quick
  identification of events.

```js
server.events.on('request', (request, event, tags) => {

    if (tags.error) {
        console.log(`Request ${event.request} error: ${event.error ? event.error.message : 'unknown'}`);
    }
});
```

To listen to only one of the channels, use the event criteria object:

```js
server.events.on({ name: 'request', channels: 'error' }, (request, event, tags) => {

    console.log(`Request ${event.request} failed`);
});
```

The internally generated events are (identified by their `tags`):

- `accept-encoding` `error` - a request received contains an invalid Accept-Encoding header.
- `auth` `unauthenticated` - no authentication scheme included with the request.
- `auth` `unauthenticated` `response` `{strategy}` - the authentication strategy listed returned a non-error response (e.g. a redirect to a login page).
- `auth` `unauthenticated` `error` `{strategy}` - the request failed to pass the listed authentication strategy (invalid credentials).
- `auth` `unauthenticated` `missing` `{strategy}` - the request failed to pass the listed authentication strategy (no credentials found).
- `auth` `unauthenticated` `try` `{strategy}` - the request failed to pass the listed authentication strategy in `'try'` mode and will continue.
- `auth` `scope` `error` - the request authenticated but failed to meet the scope requirements.
- `auth` `entity` `user` `error` - the request authenticated but included an application entity when a user entity was required.
- `auth` `entity` `app` `error` - the request authenticated but included a user entity when an application entity was required.
- `ext` `error` - an `onPostResponse` extension handler errored.
- `handler` `error` - the route handler returned an error. Includes the execution duration and the error message.
- `pre` `error` - a pre method was executed and returned an error. Includes the execution duration, assignment key, and error.
- `internal` `error` - an HTTP 500 error response was assigned to the request.
- `internal` `implementation` `error` - an incorrectly implemented [lifecycle method](#lifecycle-methods).
- `request` `abort` `error` - the request aborted.
- `request` `closed` `error` - the request closed prematurely.
- `request` `error` - the request stream emitted an error. Includes the error.
- `request` `server` `timeout` `error` - the request took too long to process by the server. Includes the timeout configuration value and the duration.
- `state` `error` - the request included an invalid cookie or cookies. Includes the cookies and error details.
- `state` `response` `error` - the response included an invalid cookie which prevented generating a valid header. Includes the error.
- `payload` `error` - failed processing the request payload. Includes the error.
- `response` `error` - failed writing the response to the client. Includes the error.
- `response` `error` `close` - failed writing the response to the client due to prematurely closed connection.
- `response` `error` `aborted` - failed writing the response to the client due to prematurely aborted connection.
- `response` `error` `cleanup` - failed freeing response resources.
- `validation` `error` `{input}` - input (i.e. payload, query, params, headers) validation failed. Includes the error. Only emitted when `failAction` is set to `'log'`.
- `validation` `response` `error` - response validation failed. Includes the error message. Only emitted when `failAction` is set to `'log'`.

##### <a name="server.events.response" /> `'response'` Event

The `'response'` event type is emitted after the response is sent back to the client (or when the
client connection closed and no response sent, in which case [`request.response`](#request.response)
is `null`). A single event is emitted per request. The `'response'` event handler uses the function
signature `function(request)` where:

- `request` - the [request object](#request).

```js
server.events.on('response', (request) => {

    console.log(`Response sent for request: ${request.info.id}`);
});
```

##### <a name="server.events.route" /> `'route'` Event

The `'route'` event type is emitted when a route is added via [`server.route()`](#server.route()).
The `'route'` event handler uses the function signature `function(route)` where:

- `route` - the [route information](#request.route). The `route` object must not be modified.

```js
server.events.on('route', (route) => {

    console.log(`New route added: ${route.path}`);
});
```

##### <a name="server.events.start" /> `'start'` Event

The `'start'` event type is emitted when the server is started using [`server.start()`](#server.start()).
The `'start'` event handler uses the function signature `function()`.

```js
server.events.on('start', () => {

    console.log('Server started');
});
```

##### <a name="server.events.closing" /> `'closing'` Event

The `'closing'` event type is emitted when the server is stopped using [`server.stop()`](#server.stop()). It is triggered when incoming requests are no longer accepted but before all underlying active connections have been closed, and thus before the [`'stop'`](#server.events.stop) event is triggered.
The `'closing'` event handler uses the function signature `function()`.

```js
server.events.on('closing', () => {

    console.log('Server is closing');
});
```

##### <a name="server.events.stop" /> `'stop'` Event

The `'stop'` event type is emitted when the server is stopped using [`server.stop()`](#server.stop()).
The `'stop'` event handler uses the function signature `function()`.

```js
server.events.on('stop', () => {

    console.log('Server stopped');
});
```

#### <a name="server.info" /> `server.info`

Access: read only.

An object containing information about the server where:

- `id` - a unique server identifier (using the format '{hostname}:{pid}:{now base36}').

- `created` - server creation timestamp.

- `started` - server start timestamp (`0` when stopped).

- `port` - the connection port based on the following rules:

    - before the server has been started: the configured [`port`](#server.options.port) value.
    - after the server has been started: the actual port assigned when no port is configured or was
      set to `0`.

- `host` - The [`host`](#server.options.host) configuration value.

- `address` - the active IP address the connection was bound to after starting. Set to `undefined`
  until the server has been started or when using a non TCP port (e.g. UNIX domain socket).

- `protocol` - the protocol used:

    - `'http'` - HTTP.
    - `'https'` - HTTPS.
    - `'socket'` - UNIX domain socket or Windows named pipe.

- `uri` - a string representing the connection (e.g. 'http://example.com:8080' or
  'socket:/unix/domain/socket/path'). Contains the [`uri`](#server.options.uri) value if set,
  otherwise constructed from the available settings. If no [`port`](#server.options.port) is
  configured or is set to `0`, the `uri` will not include a port component until the server is
  started.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

console.log(server.info.port);            // 80
```

#### <a name="server.listener" /> `server.listener`

Access: read only and listener public interface.

The node HTTP server object.

```js
const Hapi = require('@hapi/hapi');
const SocketIO = require('socket.io');

const server = Hapi.server({ port: 80 });

const io = SocketIO.listen(server.listener);
io.sockets.on('connection', (socket) => {

    socket.emit({ msg: 'welcome' });
});
```

#### <a name="server.load" /> `server.load`

Access: read only.

An object containing the process load metrics (when [`load.sampleInterval`](#server.options.load)
is enabled):

- `eventLoopDelay` - event loop delay milliseconds.
- `heapUsed` - V8 heap usage.
- `rss` - RSS memory usage.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ load: { sampleInterval: 1000 } });

console.log(server.load.rss);
```

#### <a name="server.methods" /> `server.methods`

Access: read only.

Server methods are functions registered with the server and used throughout the application as a
common utility. Their advantage is in the ability to configure them to use the built-in cache and
share across multiple request handlers without having to create a common module.

`sever.methods` is an object which provides access to the methods registered via
[server.method()](#server.method()) where each server method name is an object
property.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server();

server.method('add', (a, b) => (a + b));
const result = server.methods.add(1, 2);    // 3
```

#### <a name="server.mime" /> `server.mime`

Access: read only and **mimos** public interface.

Provides access to the server MIME database used for setting content-type information. The object
must not be modified directly but only through the [`mime`](#server.options.mime) server setting.

```js
const Hapi = require('@hapi/hapi');

const options = {
    mime: {
        override: {
            'node/module': {
                source: 'steve',
                compressible: false,
                extensions: ['node', 'module', 'npm'],
                type: 'node/module'
            }
        }
    }
};

const server = Hapi.server(options);
console.log(server.mime.path('code.js').type)        // 'application/javascript'
console.log(server.mime.path('file.npm').type)        // 'node/module'
```

#### <a name="server.plugins" /> `server.plugins`

Access: read / write.

An object containing the values exposed by each registered plugin where each key is a plugin name
and the values are the exposed properties by each plugin using
[`server.expose()`](#server.expose()). Plugins may set the value of the
`server.plugins[name]` object directly or via the `server.expose()` method.

```js
exports.plugin = {
    name: 'example',
    register: function (server, options) {

        server.expose('key', 'value');
        server.plugins.example.other = 'other';

        console.log(server.plugins.example.key);      // 'value'
        console.log(server.plugins.example.other);    // 'other'
    }
};
```

#### <a name="server.realm" /> `server.realm`

Access: read only.

The realm object contains sandboxed server settings specific to each plugin or authentication
strategy. When registering a plugin or an authentication scheme, a `server` object reference is
provided with a new `server.realm` container specific to that registration. It allows each plugin
to maintain its own settings without leaking and affecting other plugins.

For example, a plugin can set a default file path for local resources without breaking other
plugins' configured paths. When calling [`server.bind()`](#server.bind()), the active realm's
`settings.bind` property is set which is then used by routes and extensions added at the same level
(server root or plugin).

The `server.realm` object contains:

- `modifiers` - when the server object is provided as an argument to the plugin `register()`
  method, `modifiers` provides the registration preferences passed the
  [`server.register()`](#server.register()) method and includes:

    - `route` - routes preferences:

        - `prefix` - the route path prefix used by any calls to [`server.route()`](#server.route())
          from the server. Note that if a prefix is used and the route path is set to `'/'`, the
          resulting path will not include the trailing slash.
        - `vhost` - the route virtual host settings used by any calls to
          [`server.route()`](#server.route()) from the server.

- `parent` - the realm of the parent server object, or `null` for the root server.

- `plugin` - the active plugin name (empty string if at the server root).

- `pluginOptions` - the plugin options passed at registration.

- `plugins` - plugin-specific state to be shared only among activities sharing the same active
  state. `plugins` is an object where each key is a plugin name and the value is the plugin state.

- `settings` - settings overrides:

    - `files.relativeTo`
    - `bind`

The `server.realm` object should be considered read-only and must not be changed directly except
for the `plugins` property which can be directly manipulated by each plugin, setting its properties
inside `plugins[name]`.

```js
exports.register = function (server, options) {

    console.log(server.realm.modifiers.route.prefix);
};
```

#### <a name="server.registrations" /> `server.registrations`

Access: read only.

An object of the currently registered plugins where each key is a registered plugin name and the
value is an object containing:

- `version` - the plugin version.
- `name` - the plugin name.
- `options` - (optional) options passed to the plugin during registration.

#### <a name="server.settings" /> `server.settings`

Access: read only.

The server configuration object after defaults applied.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({
    app: {
        key: 'value'
    }
});

console.log(server.settings.app);   // { key: 'value' }
```

#### <a name="server.states" /> `server.states`

Access: read only and **statehood** public interface.

The server cookies manager.

#### <a name="server.states.settings" /> `server.states.settings`

Access: read only.

The server cookies manager settings. The settings are based on the values configured in
[`server.options.state`](#server.options.state).

#### <a name="server.states.cookies" /> `server.states.cookies`

Access: read only.

An object containing the configuration of each cookie added via [`server.state()`](#server.state())
where each key is the cookie name and value is the configuration object.

#### <a name="server.states.names" /> `server.states.names`

Access: read only.

An array containing the names of all configured cookies.

#### <a name="server.type" /> `server.type`

Access: read only.

A string indicating the listener type where:
- `'socket'` - UNIX domain socket or Windows named pipe.
- `'tcp'` - an HTTP listener.

#### <a name="server.version" /> `server.version`

Access: read only.

The **hapi** module version number.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server();

console.log(server.version);        // '17.0.0'
```

### <a name="server.auth.default()" /> `server.auth.default(options)`

Sets a default strategy which is applied to every route where:

- `options` - one of:

    - a string with the default strategy name
    - an authentication configuration object using the same format as the
      [route `auth` handler options](#route.options.auth).

Return value: none.

The default does not apply when a route config specifies `auth` as `false`, or has an
authentication strategy configured (contains the [`strategy`](#route.options.auth.strategy) or
[`strategies`](#route.options.auth.strategies) authentication settings). Otherwise, the route
authentication config is applied to the defaults.

Note that if the route has authentication configured, the default only applies at the time of
adding the route, not at runtime. This means that calling `server.auth.default()` after adding a
route with some authentication config will have no impact on the routes added prior. However, the
default will apply to routes added before `server.auth.default()` is called if those routes lack
any authentication config.

The default auth strategy configuration can be accessed via [`server.auth.settings.default`](#server.auth.settings.default).
To obtain the active authentication configuration of a route, use `server.auth.lookup(request.route)`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');
server.auth.default('default');

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, h) {

        return request.auth.credentials.user;
    }
});
```

### <a name="server.auth.scheme()" /> `server.auth.scheme(name, scheme)`

Registers an authentication scheme where:

- `name` - the scheme name.
- `scheme` - the method implementing the scheme with signature `function(server, options)` where:
    - `server` - a reference to the server object the scheme is added to.
    - `options` - (optional) the scheme `options` argument passed to
      [`server.auth.strategy()`](#server.auth.strategy()) when instantiation a strategy.

Return value: none.

The `scheme` function must return an [authentication scheme object](#authentication-scheme) when
invoked.

#### Authentication scheme

An authentication scheme is an object with the following properties:

- `api` - (optional) object which is exposed via the [`server.auth.api`](#server.auth.api) object.

- `async authenticate(request, h)` - (required) a [lifecycle method](#lifecycle-methods) function
  called for each incoming request configured with the authentication scheme. The method is
  provided with two special toolkit methods for returning an authenticated or an unauthenticate
  result:
    - [`h.authenticated()`](#h.authenticated()) - indicate request authenticated successfully.
    - [`h.unauthenticated()`](#h.unauthenticated()) - indicate request failed to authenticate.

- `async payload(request, h)` - (optional) a [lifecycle method](#lifecycle-methods) to authenticate
  the request payload.

- `async response(request, h)` - (optional) a [lifecycle method](#lifecycle-methods) to decorate
  the response with authentication headers before the response headers or payload is written.

- `async verify(auth)` - (optional) a method used to verify the authentication credentials provided
  are still valid (e.g. not expired or revoked after the initial authentication) where:
  - `auth` - the [`request.auth`](#request.auth) object containing the `credentials` and
    `artifacts` objects returned by the scheme's `authenticate()` method.
  - the method throws an `Error` when the credentials passed are no longer valid (e.g. expired or
  revoked). Note that the method does not have access to the original request, only to the
  credentials and artifacts produced by the `authenticate()` method.

- `options` - (optional) an object with the following keys:
    - `payload` - if `true`, requires payload validation as part of the scheme and forbids routes
      from disabling payload auth validation. Defaults to `false`.

When the scheme `authenticate()` method implementation throws an error or calls
[`h.unauthenticated()`](#h.unauthenticated()), the specifics of the error affect whether additional
authentication strategies will be attempted (if configured for the route). If the error includes a
message, no additional strategies will be attempted. If the `err` does not include a message but
does include the scheme name (e.g. `Boom.unauthorized(null, 'Custom')`), additional strategies will
be attempted in the order of preference (defined in the route configuration). If authentication
fails, the scheme names will be present in the 'WWW-Authenticate' header.

When the scheme `payload()` method throws an error with a message, it means payload validation
failed due to bad payload. If the error has no message but includes a scheme name (e.g.
`Boom.unauthorized(null, 'Custom')`), authentication may still be successful if the route
[`auth.payload`](#route.options.auth.payload) configuration is set to `'optional'`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const scheme = function (server, options) {

    return {
        authenticate: function (request, h) {

            const req = request.raw.req;
            const authorization = req.headers.authorization;
            if (!authorization) {
                throw Boom.unauthorized(null, 'Custom');
            }

            return h.authenticated({ credentials: { user: 'john' } });
        }
    };
};

server.auth.scheme('custom', scheme);
```

### <a name="server.auth.strategy()" /> `server.auth.strategy(name, scheme, [options])`

Registers an authentication strategy where:

- `name` - the strategy name.
- `scheme` - the scheme name (must be previously registered using
  [`server.auth.scheme()`](#server.auth.scheme())).
- `options` - scheme options based on the scheme requirements.

Return value: none.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

server.route({
    method: 'GET',
    path: '/',
    options: {
        auth: 'default',
        handler: function (request, h) {

            return request.auth.credentials.user;
        }
    }
});
```

### <a name="server.auth.test()" /> `await server.auth.test(strategy, request)`

Tests a request against an authentication strategy where:

- `strategy` - the strategy name registered with [`server.auth.strategy()`](#server.auth.strategy()).
- `request` - the [request object](#request).

Return value: an object containing the authentication `credentials` and `artifacts` if authentication
was successful, otherwise throws an error.

Note that the `test()` method does not take into account the route authentication configuration. It
also does not perform payload authentication. It is limited to the basic strategy authentication
execution. It does not include verifying scope, entity, or other route properties.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

server.route({
    method: 'GET',
    path: '/',
    handler: async function (request, h) {

        try {
            const { credentials, artifacts } = await request.server.auth.test('default', request);
            return { status: true, user: credentials.name };
        }
        catch (err) {
            return { status: false };
        }
    }
});
```


### <a name="server.auth.verify()" /> `await server.auth.verify(request)`

Verify a request's authentication credentials against an authentication strategy where:

- `request` - the [request object](#request).

Return value: nothing if verification was successful, otherwise throws an error.

Note that the `verify()` method does not take into account the route authentication configuration
or any other information from the request other than the `request.auth` object. It also does not
perform payload authentication. It is limited to verifying that the previously valid credentials
are still valid (e.g. have not been revoked or expired). It does not include verifying scope,
entity, or other route properties.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

server.route({
    method: 'GET',
    path: '/',
    handler: async function (request, h) {

        try {
            const credentials = await request.server.auth.verify(request);
            return { status: true, user: credentials.name };
        }
        catch (err) {
            return { status: false };
        }
    }
});
```

### <a name="server.bind()" /> `server.bind(context)`

Sets a global context used as the default bind object when adding a route or an extension where:

- `context` - the object used to bind `this` in [lifecycle methods](#lifecycle-methods) such as
  the [route handler](#route.options.handler) and [extension methods](#server.ext()). The context
  is also made available as [`h.context`](#h.context).

Return value: none.

When setting a context inside a plugin, the context is applied only to methods set up by the
plugin. Note that the context applies only to routes and extensions added after it has been set.
Ignored if the method being bound is an arrow function.

```js
const handler = function (request, h) {

    return this.message;    // Or h.context.message
};

exports.plugin = {
    name: 'example',
    register: function (server, options) {

        const bind = {
            message: 'hello'
        };

        server.bind(bind);
        server.route({ method: 'GET', path: '/', handler });
    }
};
```

### <a name="server.cache()" /> `server.cache(options)`

Provisions a cache segment within the server cache facility where:

- `options` - [**catbox** policy](https://hapi.dev/family/catbox/api#policy) configuration where:

    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was
      saved in the cache. Cannot be used together with `expiresAt`.

    - `expiresAt` - time of day expressed in 24h notation using the 'HH:MM' format, at which point
      all cache records expire. Uses local time. Cannot be used together with `expiresIn`.

    - `generateFunc` - a function used to generate a new cache item if one is not found in the
      cache when calling `get()`. The method's signature is `async function(id, flags)` where:

          - `id` - the `id` string or object provided to the `get()` method.
          - `flags` - an object used to pass back additional flags to the cache where:
              - `ttl` - the cache ttl value in milliseconds. Set to `0` to skip storing in the
                cache. Defaults to the cache global policy.

    - `staleIn` - number of milliseconds to mark an item stored in cache as stale and attempt to
      regenerate it when `generateFunc` is provided. Must be less than `expiresIn`.

    - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.

    - `generateTimeout` - number of milliseconds to wait before returning a timeout error when the
      `generateFunc` function takes too long to return a value. When the value is eventually
      returned, it is stored in the cache for future requests. Required if `generateFunc` is
      present. Set to `false` to disable timeouts which may cause all `get()` requests to get stuck
      forever.

    - `generateOnReadError` - if `false`, an upstream cache read error will stop the `cache.get()`
      method from calling the generate function and will instead pass back the cache error. Defaults
      to `true`.

    - `generateIgnoreWriteError` - if `false`, an upstream cache write error when calling
      `cache.get()` will be passed back with the generated value when calling. Defaults to `true`.

    - `dropOnError` - if `true`, an error or timeout in the `generateFunc` causes the stale value
      to be evicted from the cache.  Defaults  to `true`.

    - `pendingGenerateTimeout` - number of milliseconds while `generateFunc` call is in progress
      for a given id, before a subsequent `generateFunc` call is allowed. Defaults to `0` (no
      blocking of concurrent `generateFunc` calls beyond `staleTimeout`).

    - `cache` - the cache name configured in [`server.cache`](#server.options.cache). Defaults to
      the default cache.

    - `segment` - string segment name, used to isolate cached items within the cache partition.
      When called within a plugin, defaults to '!name' where 'name' is the plugin name. When called
      within a server method, defaults to '#name' where 'name' is the server method name. Required
      when called outside of a plugin.

    - `shared` - if `true`, allows multiple cache provisions to share the same segment. Default to
      `false`.

Return value: a [**catbox** policy](https://hapi.dev/family/catbox/api#policy) object.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    const cache = server.cache({ segment: 'countries', expiresIn: 60 * 60 * 1000 });
    await cache.set('norway', { capital: 'oslo' });
    const value = await cache.get('norway');
}
```

### <a name="server.cache.provision()" /> `await server.cache.provision(options)`

Provisions a server cache as described in [`server.cache`](#server.options.cache) where:

- `options` - same as the server [`cache`](#server.options.cache) configuration options.

Return value: none.

Note that if the server has been initialized or started, the cache will be automatically started
to match the state of any other provisioned server cache.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    await server.initialize();
    await server.cache.provision({ provider: require('@hapi/catbox-memory'), name: 'countries' });

    const cache = server.cache({ cache: 'countries', expiresIn: 60 * 60 * 1000 });
    await cache.set('norway', { capital: 'oslo' });
    const value = await cache.get('norway');
}
```

### <a name="server.control()" /> `server.control(server)`

Links another server to the initialize/start/stop state of the current server by calling the
controlled server `initialize()`/`start()`/`stop()` methods whenever the current server methods
are called, where:

- `server` - the **hapi** server object to be controlled.

### <a name="server.decoder()" /> `server.decoder(encoding, decoder)`

Registers a custom content decoding compressor to extend the built-in support for `'gzip'` and
'`deflate`' where:

- `encoding` - the decoder name string.

- `decoder` - a function using the signature `function(options)` where `options` are the encoding
  specific options configured in the route [`payload.compression`](#route.options.payload.compression)
  configuration option, and the return value is an object compatible with the output of node's
  [`zlib.createGunzip()`](https://nodejs.org/api/zlib.html#zlib_zlib_creategunzip_options).

Return value: none.

```js
const Zlib = require('zlib');
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80, routes: { payload: { compression: { special: { chunkSize: 16 * 1024 } } } } });

server.decoder('special', (options) => Zlib.createGunzip(options));
```

### <a name="server.decorate()" /> `server.decorate(type, property, method, [options])`

Extends various framework interfaces with custom methods where:

- `type` - the interface being decorated. Supported types:

    - `'handler'` - adds a new handler type to be used in [routes handlers](#route.options.handler).
    - `'request'` - adds methods to the [Request object](#request).
    - `'response'` - adds methods to the [Response object](#response-object).
    - `'server'` - adds methods to the [Server](#server) object.
    - `'toolkit'` - adds methods to the [response toolkit](#response-toolkit).

- `property` - the object decoration key name or symbol.

- `method` - the extension function or other value.

- `options` - (optional) supports the following optional settings:
    - `apply` - when the `type` is `'request'`, if `true`, the `method` function is invoked using
      the signature `function(request)` where `request` is the current request object and the
      returned value is assigned as the decoration.
    - `extend` - if `true`, overrides an existing decoration. The `method` must be a function with
      the signature `function(existing)` where:
        - `existing` - is the previously set decoration method value.
        - must return the new decoration function or value.
        - cannot be used to extend handler decorations.

Return value: none.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const success = function () {

    return this.response({ status: 'ok' });
};

server.decorate('toolkit', 'success', success);

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, h) {

        return h.success();
    }
});
```

When registering a handler decoration, the `method` must be a function using the signature
`function(route, options)` where:

- `route` - the [route information](#request.route).
- `options` - the configuration object provided in the handler config.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ host: 'localhost', port: 8000 });

    // Defines new handler for routes on this server

    const handler = function (route, options) {

        return function (request, h) {

            return 'new handler: ' + options.msg;
        }
    };

    server.decorate('handler', 'test', handler);

    server.route({
        method: 'GET',
        path: '/',
        handler: { test: { msg: 'test' } }
    });

    await server.start();
}
```

The `method` function can have a `defaults` object or function property. If the property is set to
an object, that object is used as the default route config for routes using this handler. If the
property is set to a function, the function uses the signature `function(method)` and returns the
route default configuration.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ host: 'localhost', port: 8000 });

const handler = function (route, options) {

    return function (request, h) {

        return 'new handler: ' + options.msg;
    }
};

// Change the default payload processing for this handler

handler.defaults = {
    payload: {
        output: 'stream',
        parse: false
    }
};

server.decorate('handler', 'test', handler);
```

### <a name="server.dependency()" /> `server.dependency(dependencies, [after])`

Used within a plugin to declare a required dependency on other [plugins](#plugins) required for
the current plugin to operate (plugins listed must be registered before the server is initialized
or started) where:

- `dependencies` - one of:
  - a single plugin name string.
  - an array of plugin name strings.
  - an object where each key is a plugin name and each matching value is a
   [version range string](https://www.npmjs.com/package/semver) which must match the registered
   plugin version.

- `after` - (optional) a function that is called after all the specified dependencies have been
registered and before the server starts. The function is only called if the server is initialized
or started. The function signature is `async function(server)` where:

    - `server` - the server the `dependency()` method was called on.

Return value: none.

The `after` method is identical to setting a server extension point on `'onPreStart'`.

If a circular  dependency is detected, an exception is thrown (e.g. two plugins each has an `after`
function to be called after the other).

```js
const after = function (server) {

    // Additional plugin registration logic
};

exports.plugin = {
    name: 'example',
    register: function (server, options) {

        server.dependency('yar', after);
    }
};
```

Dependencies can also be set via the plugin `dependencies` property (does not support setting
`after`):

```js
exports.plugin = {
    name: 'test',
    version: '1.0.0',
    dependencies: {
        yar: '1.x.x'
    },
    register: function (server, options) { }
};
```

The `dependencies` configuration accepts one of:
  - a single plugin name string.
  - an array of plugin name strings.
  - an object where each key is a plugin name and each matching value is a
   [version range string](https://www.npmjs.com/package/semver) which must match the registered
   plugin version.

### <a name="server.encoder()" /> `server.encoder(encoding, encoder)`

Registers a custom content encoding compressor to extend the built-in support for `'gzip'` and
'`deflate`' where:

- `encoding` - the encoder name string.

- `encoder` - a function using the signature `function(options)` where `options` are the encoding
  specific options configured in the route [`compression`](#route.options.compression) option, and
  the return value is an object compatible with the output of node's
  [`zlib.createGzip()`](https://nodejs.org/api/zlib.html#zlib_zlib_creategzip_options).

Return value: none.

```js
const Zlib = require('zlib');
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80, routes: { compression: { special: { chunkSize: 16 * 1024 } } } });

server.encoder('special', (options) => Zlib.createGzip(options));
```

### <a name="server.event()" /> `server.event(events)`

Register custom application events where:

- `events` - must be one of:

    - an event name string.

    - an event options object with the following optional keys (unless noted otherwise):

        - `name` - the event name string (required).

        - `channels` - a string or array of strings specifying the event channels available. Defaults to no channel restrictions (event updates can specify a channel or not).

        - `clone` - if `true`, the `data` object passed to [`server.events.emit()`](#server.events.emit()) is cloned before it is passed to the listeners (unless an override specified by each listener). Defaults to `false` (`data` is passed as-is).

        - `spread` - if `true`, the `data` object passed to [`server.event.emit()`](#server.event.emit()) must be an array and the `listener` method is called with each array element passed as a separate argument (unless an override specified by each listener). This should only be used when the emitted data structure is known and predictable. Defaults to `false` (`data` is emitted as a single argument regardless of its type).

        - `tags` - if `true` and the `criteria` object passed to [`server.event.emit()`](#server.event.emit()) includes `tags`, the tags are mapped to an object (where each tag string is the key and the value is `true`) which is appended to the arguments list at the end. A configuration override can be set by each listener. Defaults to `false`.

        - `shared` - if `true`, the same event `name` can be registered multiple times where the second registration is ignored. Note that if the registration config is changed between registrations, only the first configuration is used. Defaults to `false` (a duplicate registration will throw an error).

    - a [**podium**](https://hapi.dev/family/podium/api) emitter object.

    - an array containing any of the above.

Return value: none.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.event('test');
    server.events.on('test', (update) => console.log(update));
    await server.events.emit('test', 'hello');
}
```

### <a name="server.events.emit()" /> `await server.events.emit(criteria, data)`

Emits a custom application event to all the subscribed listeners where:

- `criteria` - the event update criteria which must be one of:

    - the event name string.
    - an object with the following optional keys (unless noted otherwise):
        - `name` - the event name string (required).
        - `channel` - the channel name string.
        - `tags` - a tag string or array of tag strings.

- `data` - the value emitted to the subscribers. If `data` is a function, the function signature is `function()` and it called once to generate (return value) the actual data emitted to the listeners. If no listeners match the event, the `data` function is not invoked.

Return value: none.

Note that events must be registered before they can be emitted or subscribed to by calling [`server.event(events)`](#server.event()). This is done to detect event name misspelling and invalid event activities.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.event('test');
    server.events.on('test', (update) => console.log(update));
    await server.events.emit('test', 'hello');          // await is optional
}
```

### <a name="server.events.on()" /> `server.events.on(criteria, listener)`

Subscribe to an event where:

- `criteria` - the subscription criteria which must be one of:

    - event name string which can be any of the [built-in server events](#server.events) or a
      custom application event registered with [`server.event()`](#server.event()).

    - a criteria object with the following optional keys (unless noted otherwise):

        - `name` - (required) the event name string.

        - `channels` - a string or array of strings specifying the event channels to subscribe to.
          If the event registration specified a list of allowed channels, the `channels` array must
          match the allowed channels. If `channels` are specified, event updates without any
          channel designation will not be included in the subscription. Defaults to no channels
          filter.

        - `clone` - if `true`, the `data` object passed to [`server.event.emit()`](#server.event.emit())
           is cloned before it is passed to the `listener` method. Defaults to the event
           registration option (which defaults to `false`).

        - `count` - a positive integer indicating the number of times the `listener` can be called
          after which the subscription is automatically removed. A count of `1` is the same as
          calling `server.events.once()`. Defaults to no limit.

        - `filter` - the event tags (if present) to subscribe to which can be one of:

            - a tag string.
            - an array of tag strings.
            - an object with the following:

                - `tags` - a tag string or array of tag strings.
                - `all` - if `true`, all `tags` must be present for the event update to match the
                  subscription. Defaults to `false` (at least one matching tag).

        - `spread` - if `true`, and the `data` object passed to [`server.event.emit()`](#server.event.emit())
          is an array, the `listener` method is called with each array element passed as a separate
          argument. This should only be used when the emitted data structure is known and
          predictable. Defaults to the event registration option (which defaults to `false`).

        - `tags` - if `true` and the `criteria` object passed to [`server.event.emit()`](#server.event.emit())
          includes `tags`, the tags are mapped to an object (where each tag string is the key and
          the value is `true`) which is appended to the arguments list at the end. Defaults to the
          event registration option (which defaults to `false`).

- `listener` - the handler method set to receive event updates. The function signature depends on
  the event argument, and the `spread` and `tags` options.

Return value: none.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.event('test');
    server.events.on('test', (update) => console.log(update));
    await server.events.emit('test', 'hello');
}
```

### <a name="server.events.once()" /> `server.events.once(criteria, listener)`

Same as calling [`server.events.on()`](#server.events.on()) with the `count` option set to `1`.

Return value: none.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.event('test');
    server.events.once('test', (update) => console.log(update));
    await server.events.emit('test', 'hello');
    await server.events.emit('test', 'hello');       // Ignored
}
```

### <a name="server.events.once.await()" /> `await server.events.once(criteria)`

Same as calling [`server.events.on()`](#server.events.on()) with the `count` option set to `1`.

 Return value: a promise that resolves when the event is emitted.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.event('test');
    const pending = server.events.once('test');
    await server.events.emit('test', 'hello');
    const update = await pending;
}
```

### <a name="server.expose()" /> `server.expose(key, value, [options])`

Used within a plugin to expose a property via [`server.plugins[name]`](#server.plugins) where:

- `key` - the key assigned ([`server.plugins[name][key]`](#server.plugins)).
- `value` - the value assigned.
- `options` - optional settings:
    - `scope` - controls how to handle the presence of a plugin scope in the name (e.g. `@hapi/test`):
        - `false` - the scope is removed (e.g. `@hapi/test` is changed to `test` under `server.plugins`). This is the default.
        - `true` - the scope is retained as-is (e.g. `@hapi/test` is used as `server.plugins['@hapi/test']`).
        - `'underscore'` - the scope is rewritten (e.g. `@hapi/test` is used as `server.plugins.hapi__test`).

Return value: none.

```js
exports.plugin =
    name: 'example',
    register: function (server, options) {

        server.expose('util', () => console.log('something'));
    }
};
```

### <a name="server.expose.obj()" /> `server.expose(obj)`

Merges an object into to the existing content of [`server.plugins[name]`](#server.plugins) where:

- `obj` - the object merged into the exposed properties container.

Return value: none.

```js
exports.plugin = {
    name: 'example',
    register: function (server, options) {

        server.expose({ util: () => console.log('something') });
    }
};
```

Note that all the properties of `obj` are deeply cloned into [`server.plugins[name]`](#server.plugins),
so avoid using this method for exposing large objects that may be expensive to clone or singleton
objects such as database client objects. Instead favor [`server.expose(key, value)`](#server.expose()),
which only copies a reference to `value`.

### <a name="server.ext()" /> `server.ext(events)`

Registers an extension function in one of the [request lifecycle](#request-lifecycle) extension
points where:

- `events` - an object or array of objects with the following:

    - `type` - (required) the extension point event name. The available extension points include
      the [request extension points](#request-lifecycle) as well as the following server extension
      points:

        - `'onPreStart'` - called before the connection listeners are started.
        - `'onPostStart'` - called after the connection listeners are started.
        - `'onPreStop'` - called before the connection listeners are stopped.
        - `'onPostStop'` - called after the connection listeners are stopped.

    - `method` - (required) a function or an array of functions to be executed at a specified point
      during request processing. The required extension function signature is:

        - server extension points: `async function(server)` where:

            - `server` - the server object.
            - `this` - the object provided via `options.bind` or the current active context set
              with [`server.bind()`](#server.bind()).

        - request extension points: a [lifecycle method](#lifecycle-methods).

    - `options` - (optional) an object with the following:

        - `before` - a string or array of strings of plugin names this method must execute before
          (on the same event). Otherwise, extension methods are executed in the order added.

        - `after` - a string or array of strings of plugin names this method must execute after (on
          the same event). Otherwise, extension methods are executed in the order added.

        - `bind` - a context object passed back to the provided method (via `this`) when called.
           Ignored if the method is an arrow function.

        - `sandbox` - if set to `'plugin'` when adding a [request extension points](#request-lifecycle)
          the extension is only added to routes defined by the current plugin. Not allowed when
          configuring route-level extensions, or when adding server extensions. Defaults to
          `'server'` which applies to any route added to the server the extension is added to.

        - `timeout` - number of milliseconds to wait for the `method` to complete before returning
          a timeout error. Defaults to no timeout.

Return value: none.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });

    server.ext({
        type: 'onRequest',
        method: function (request, h) {

            // Change all requests to '/test'

            request.setUrl('/test');
            return h.continue;
        }
    });

    server.route({ method: 'GET', path: '/test', handler: () => 'ok' });
    await server.start();

    // All requests will get routed to '/test'
}
```

### <a name="server.ext.args()" /> `server.ext(event, [method, [options]])`

Registers a single extension event using the same properties as used in [`server.ext(events)`](#server.ext()), but passed as arguments.

The `method` may be omitted (if `options` isn't present) or passed `null` which will cause the function to return a promise. The promise is resolved with the `request` object on the first invocation of the extension point. This is primarily used for writing tests without having to write custom handlers just to handle a single event.

Return value: a promise if `method` is omitted, otherwise `undefined`.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });

    server.ext('onRequest', function (request, h) {

        // Change all requests to '/test'

        request.setUrl('/test');
        return h.continue;
    });

    server.route({ method: 'GET', path: '/test', handler: () => 'ok' });
    await server.start();

    // All requests will get routed to '/test'
}
```

### <a name="server.initialize()" /> `await server.initialize()`

Initializes the server (starts the caches, finalizes plugin registration) but does not start
listening on the connection port.

Return value: none.

Note that if the method fails and throws an error, the server is considered to be in an undefined
state and should be shut down. In most cases it would be impossible to fully recover as the various
plugins, caches, and other event listeners will get confused by repeated attempts to start the
server or make assumptions about the healthy state of the environment. It is recommended to abort
the process when the server fails to start properly. If you must try to resume after an error, call
[`server.stop()`](#server.stop()) first to reset the server state.

```js
const Hapi = require('@hapi/hapi');
const Hoek = require('@hapi/hoek');

async function example() {

    const server = Hapi.server({ port: 80 });
    await server.initialize();
}
```

### <a name="server.inject()" /> `await server.inject(options)`

Injects a request into the server simulating an incoming HTTP request without making an actual
socket connection. Injection is useful for testing purposes as well as for invoking routing logic
internally without the overhead and limitations of the network stack.

The method utilizes the [**shot**](https://hapi.dev/family/shot/api) module for performing
injections, with some additional options and response properties:

- `options` - can be assigned a string with the requested URI, or an object with:

    - `method` - (optional) the request HTTP method (e.g. `'POST'`). Defaults to `'GET'`.

    - `url` - (required) the request URL. If the URI includes an authority
      (e.g. `'example.com:8080'`), it is used to automatically set an HTTP 'Host' header, unless
      one was specified in `headers`.

    - `authority` - (optional) a string specifying the HTTP 'Host' header value. Only used if 'Host'
      is not specified in `headers` and the `url` does not include an authority component.
      Default is inferred from runtime server information.

    - `headers` - (optional) an object with optional request headers where each key is the header
      name and the value is the header content. Defaults to no additions to the default **shot**
      headers.

    - `payload` - (optional) an string, buffer or object containing the request payload. In case of
      an object it will be converted to a string for you. Defaults to no payload. Note that payload
      processing defaults to `'application/json'` if no 'Content-Type' header provided.

    - `auth` - (optional) an object containing parsed authentication credentials where:

        - `strategy` - (required) the authentication strategy name matching the provided
          credentials.

        - `credentials` - (required) a credentials object containing authentication information.
          The `credentials` are used to bypass the default authentication strategies, and are
          validated directly as if they were received via an authentication scheme.

        - `artifacts` - (optional) an artifacts object containing authentication artifact
          information. The `artifacts` are used to bypass the default authentication strategies,
          and are validated directly as if they were received via an authentication scheme.
          Defaults to no artifacts.

    - `app` - (optional) sets the initial value of `request.app`, defaults to `{}`.

    - `plugins` - (optional) sets the initial value of `request.plugins`, defaults to `{}`.

    - `allowInternals` - (optional) allows access to routes with `config.isInternal` set to `true`.
      Defaults to `false`.

    - `remoteAddress` - (optional) sets the remote address for the incoming connection.

    - `simulate` - (optional) an object with options used to simulate client request stream
      conditions for testing:

        - `error` - if `true`, emits an `'error'` event after payload transmission (if any).
          Defaults to `false`.

        - `close` - if `true`, emits a `'close'` event after payload transmission (if any).
          Defaults to `false`.

        - `end` - if `false`, does not end the stream. Defaults to `true`.

        - `split` - indicates whether the request payload will be split into chunks. Defaults to
          `undefined`, meaning payload will not be chunked.

    - `validate` - (optional) if `false`, the `options` inputs are not validated. This is
      recommended for run-time usage of `inject()` to make it perform faster where input validation
      can be tested separately.

Return value: a response object with the following properties:

- `statusCode` - the HTTP status code.

- `headers` - an object containing the headers set.

- `payload` - the response payload string.

- `rawPayload` - the raw response payload buffer.

- `raw` - an object with the injection request and response objects:

    - `req` - the simulated node request object.
    - `res` - the simulated node response object.

- `result` - the raw handler response (e.g. when not a stream or a view) before it is
    serialized for transmission. If not available, the value is set to `payload`. Useful for
    inspection and reuse of the internal objects returned (instead of parsing the response
    string).

- `request` - the [request object](#request).

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.route({ method: 'GET', path: '/', handler: () => 'Success!' });

    const res = await server.inject('/');
    console.log(res.result);                // 'Success!'
}
```

### <a name="server.log()" /> `server.log(tags, [data, [timestamp]])`

Logs server events that cannot be associated with a specific request. When called the server emits
a `'log'` event which can be used by other listeners or [plugins](#plugins) to record the
information or output to the console. The arguments are:

- `tags` - (required) a string or an array of strings (e.g. `['error', 'database', 'read']`) used
  to identify the event. Tags are used instead of log levels and provide a much more expressive
  mechanism for describing and filtering events. Any logs generated by the server internally
  include the `'hapi'` tag along with event-specific information.

- `data` - (optional) an message string or object with the application data being logged. If `data`
  is a function, the function signature is `function()` and it called once to generate (return
  value) the actual data emitted to the listeners. If no listeners match the event, the `data`
  function is not invoked.

- `timestamp` - (optional) an timestamp expressed in milliseconds. Defaults to `Date.now()` (now).

Return value: none.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.events.on('log', (event, tags) => {

    if (tags.error) {
        console.log(event);
    }
});

server.log(['test', 'error'], 'Test event');
```

### <a name="server.lookup()" /> `server.lookup(id)`

Looks up a route configuration where:

- `id` - the [route identifier](#route.options.id).

Return value: the [route information](#request.route) if found, otherwise `null`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server();
server.route({
    method: 'GET',
    path: '/',
    options: {
        id: 'root',
        handler: () => 'ok'
    }
});

const route = server.lookup('root');
```

### <a name="server.match()" /> `server.match(method, path, [host])`

Looks up a route configuration where:

- `method` - the HTTP method (e.g. 'GET', 'POST').
- `path` - the requested path (must begin with '/').
- `host` - (optional) hostname (to match against routes with `vhost`).

Return value: the [route information](#request.route) if found, otherwise `null`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server();
server.route({
    method: 'GET',
    path: '/',
    options: {
        id: 'root',
        handler: () => 'ok'
    }
});

const route = server.match('get', '/');
```

### <a name="server.method()" /> `server.method(name, method, [options])`

Registers a [server method](#server.methods) where:

- `name` - a unique method name used to invoke the method via [`server.methods[name]`](#server.method).

- `method` - the method function with a signature `async function(...args, [flags])` where:
    - `...args` - the method function arguments (can be any number of arguments or none).
    - `flags` - when caching is enabled, an object used to set optional method result flags. This
      parameter is provided automatically and can only be accessed/modified within the method
      function. It cannot be passed as an argument.
        - `ttl` - `0` if result is valid but cannot be cached. Defaults to cache policy.

- `options` - (optional) configuration object:

    - `bind` - a context object passed back to the method function (via `this`) when called.
      Defaults to active context (set via [`server.bind()`](#server.bind()) when the method is
      registered. Ignored if the method is an arrow function.

    - `cache` - the same cache configuration used in [`server.cache()`](#server.cache()). The
      `generateTimeout` option is required, and the `generateFunc` options is not allowed.

    - `generateKey` - a function used to generate a unique key (for caching) from the arguments
      passed to the method function (the `flags` argument is not passed as input). The server
      will automatically generate a unique key if the function's arguments are all of types
      `'string'`, `'number'`, or `'boolean'`. However if the method uses other types of arguments,
      a key generation function must be provided which takes the same arguments as the function and
      returns a unique string (or `null` if no key can be generated).

Return value: none.

Method names can be nested (e.g. `utils.users.get`) which will automatically create the full path
under [`server.methods`](#server.methods) (e.g. accessed via `server.methods.utils.users.get`).

When configured with caching enabled, `server.methods[name].cache` is assigned an object with the
following properties and methods:
    - `await drop(...args)` - a function that can be used to clear the cache for a given key.
    - `stats` - an object with cache statistics, see **catbox** for stats documentation.

Simple arguments example:

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });

    const add = (a, b) => (a + b);
    server.method('sum', add, { cache: { expiresIn: 2000, generateTimeout: 100 } });

    console.log(await server.methods.sum(4, 5));          // 9
}
```

Object argument example:

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });

    const addArray = function (array) {

        let sum = 0;
        array.forEach((item) => {

            sum += item;
        });

        return sum;
    };

    const options = {
        cache: { expiresIn: 2000, generateTimeout: 100 },
        generateKey: (array) => array.join(',')
    };

    server.method('sumObj', addArray, options);

    console.log(await server.methods.sumObj([5, 6]));     // 11
}
```

### <a name="server.method.array()" /> `server.method(methods)`

Registers a server method function as described in [`server.method()`](#server.method()) using a
configuration object where:

- `methods` - an object or an array of objects where each one contains:

    - `name` - the method name.
    - `method` - the method function.
    - `options` - (optional) settings.

Return value: none.

```js
const add = function (a, b) {

    return a + b;
};

server.method({
    name: 'sum',
    method: add,
    options: {
        cache: {
            expiresIn: 2000,
            generateTimeout: 100
        }
    }
});
```

### <a name="server.path()" /> `server.path(relativeTo)`

Sets the path prefix used to locate static resources (files and view templates) when relative paths
are used where:

- `relativeTo` - the path prefix added to any relative file path starting with `'.'`.

Return value: none.

Note that setting a path within a plugin only applies to resources accessed by plugin methods.
If no path is set, the server default [route configuration](#server.options.routes)
[`files.relativeTo`](#route.options.files) settings is used. The path only applies to routes added
after it has been set.

```js
exports.plugin = {
    name: 'example',
    register: function (server, options) {

        // Assuming the Inert plugin was registered previously

        server.path(__dirname + '../static');
        server.route({ path: '/file', method: 'GET', handler: { file: './test.html' } });
    }
};
```

### <a name="server.register()" /> `await server.register(plugins, [options])`

Registers a plugin where:

- `plugins` - one or an array of:

    - a [plugin object](#plugins).

    - an object with the following:
        - `plugin` - a [plugin object](#plugins).
        - `options` - (optional) options passed to the plugin during registration.
        - `once`, `routes` - (optional) plugin-specific registration options as defined below.

- `options` - (optional) registration options (different from the options passed to the
  registration function):

    - `once` - if `true`, subsequent registrations of the same plugin are skipped without error.
      Cannot be used with plugin options. Defaults to `false`.
      If not set to `true`, an error will be thrown the second time a plugin is registered on the server.

    - `routes` - modifiers applied to each route added by the plugin:

        - `prefix` - string added as prefix to any route path (must begin with `'/'`). If a plugin
          registers a child plugin the `prefix` is passed on to the child or is added in front of
          the child-specific prefix.
        - `vhost` - virtual host string (or array of strings) applied to every route. The
          outer-most `vhost` overrides the any nested configuration.

Return value: none.

```js
async function example() {

    await server.register({ plugin: require('plugin_name'), options: { message: 'hello' } });
}
```

### <a name="server.route()" /> `server.route(route)`

Adds a route where:

- `route` - a route configuration object or an array of configuration objects where each object
  contains:

    - `path` - (required) the absolute path used to match incoming requests (must begin with '/').
      Incoming requests are compared to the configured paths based on the server's
      [`router`](#server.options.router) configuration. The path can include named parameters
      enclosed in `{}` which  will be matched against literal values in the request as described in
      [Path parameters](#path-parameters).

    - `method` - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH',
      'DELETE', or 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'. Use `'*'` to match
      against any HTTP method (only when an exact match was not found, and any match with a
      specific method will be given a higher priority over a wildcard match). Can be assigned an
      array of methods which has the same result as adding the same route with different methods
      manually.

    - `vhost` - (optional) a domain string or an array of domain strings for limiting the route to
      only requests with a matching host header field. Matching is done against the hostname part
      of the header only (excluding the port). Defaults to all hosts.

    - `handler` - (required when [`handler`](#route.options.handler) is not set) the route
      handler function called to generate the response after successful authentication and
      validation.

    - `options` - additional [route options](#route-options). The `options` value can be an object
      or a function that returns an object using the signature `function(server)` where `server` is
      the server the route is being added to and `this` is bound to the current
      [realm](#server.realm)'s `bind` option.

    - `rules` - route custom rules object. The object is passed to each rules processor registered
      with [`server.rules()`](#server.rules()). Cannot be used if
      [`route.options.rules`](#route.options.rules) is defined.

Return value: none.

Note that the `options` object is deeply cloned (with the exception of `bind` which is shallowly
copied) and cannot contain any values that are unsafe to perform deep copy on.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

// Handler in top level

server.route({ method: 'GET', path: '/status', handler: () => 'ok' });

// Handler in config

const user = {
    cache: { expiresIn: 5000 },
    handler: function (request, h) {

        return { name: 'John' };
    }
};

server.route({ method: 'GET', path: '/user', options: user });

// An array of routes

server.route([
    { method: 'GET', path: '/1', handler: function (request, h) { return 'ok'; } },
    { method: 'GET', path: '/2', handler: function (request, h) { return 'ok'; } }
]);
```

#### Path parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming
request path at that path segment. For example, `'/book/{id}/cover'` will match `'/book/123/cover'` and
`request.params.id` will be set to `'123'`. Each path segment (everything between the opening `'/'`
and the closing `'/'` unless it is the end of the path) can only include one named parameter. A
parameter can cover the entire segment (`'/{param}'`) or part of the segment (`'/file.{ext}'`).  A path
parameter may only contain letters, numbers and underscores, e.g. `'/{file-name}'` is invalid
and `'/{file_name}'` is valid.

An optional `'?'` suffix following the parameter name indicates an optional parameter (only allowed
if the parameter is at the ends of the path or only covers part of the segment as in
`'/a{param?}/b'`). For example, the route `'/book/{id?}'` matches `'/book/'` with the value of
`request.params.id` set to an empty string `''`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const getAlbum = function (request, h) {

    return 'You asked for ' +
        (request.params.song ? request.params.song + ' from ' : '') +
        request.params.album;
};

server.route({
    path: '/{album}/{song?}',
    method: 'GET',
    handler: getAlbum
});
```

In addition to the optional `?` suffix, a parameter name can also specify the number of matching
segments using the `*` suffix, followed by a number greater than 1. If the number of expected parts
can be anything, then use `*` without a number (matching any number of segments can only be used in
the last path segment).

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const getPerson = function (request, h) {

    const nameParts = request.params.name.split('/');
    return { first: nameParts[0], last: nameParts[1] };
};

server.route({
    path: '/person/{name*2}',   // Matches '/person/john/doe'
    method: 'GET',
    handler: getPerson
});
```

#### Path matching order

The router iterates through the routing table on each incoming request and executes the first (and
only the first) matching route. Route matching is done based on the combination of the request path
and the HTTP verb (e.g. 'GET, 'POST'). The query is excluded from the routing logic. Requests are
matched in a deterministic order where the order in which routes are added does not matter.

Routes are matched based on the specificity of the route which is evaluated at each segment of the
incoming request path. Each request path is split into its segment (the parts separated by `'/'`).
The segments are compared to the routing table one at a time and are matched against the most
specific path until a match is found. If no match is found, the next match is tried.

When matching routes, string literals (no path parameter) have the highest priority, followed by
mixed parameters (`'/a{p}b'`), parameters (`'/{p}'`), and then wildcard (`/{p*}`).

Note that mixed parameters are slower to compare as they cannot be hashed and require an array
iteration over all the regular expressions representing the various mixed parameter at each
routing table node.

#### Catch all route

If the application needs to override the default Not Found (404) error response, it can add a
catch-all route for a specific method or all methods. Only one catch-all route can be defined.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const handler = function (request, h) {

    return h.response('The page was not found').code(404);
};

server.route({ method: '*', path: '/{p*}', handler });
```

### <a name="server.rules()" /> `server.rules(processor, [options])`

Defines a route rules processor for converting route rules object into route configuration where:

- `processor` - a function using the signature `function(rules, info)` where:
    - `rules` - the [custom object](#route.options.rules) defined in your routes configuration for you to use its values.
    - `info` - an object with the following properties:
        - `method` - the route method.
        - `path` - the route path.
        - `vhost` - the route virtual host (if any defined).
    - returns a route config object.

- `options` - optional settings:
    - `validate` - rules object validation:
        - `schema` - **joi** schema.
        - `options` - optional **joi** validation options. Defaults to `{ allowUnknown: true }`.

Note that the root server and each plugin server instance can only register one rules processor.
If a route is added after the rules are configured, it will not include the rules config. Routes
added by plugins apply the rules to each of the parent realms' rules from the root to the route's
realm. This means the processor defined by the plugin overrides the config generated by the root
processor if they overlap. Similarly, the route's own config overrides the config produced by the rules processors.

```js
const validateSchema = {
    auth: Joi.string(),
    myCustomPre: Joi.array().min(2).items(Joi.string()),
    payload: Joi.object()
};

const myPreHelper = (name) => {

    return {
        method: (request, h) => {

            return `hello ${name || 'world'}!`;
        },
        assign: 'myPreHelper'
    };
};

const processor = (rules, info) => {

    if (!rules) {
        return null;
    }

    const options = {};

    if (rules.auth) {
        options.auth = {
            strategy: rules.auth,
            validate: {
                entity: 'user'
            }
        };
    }

    if (rules.myCustomPre) {
        options.pre = [
            myPreHelper(...rules.myCustomPre)
        ];
    }

    if (rules.payload) {
        options.validate = { payload: Joi.object(rules.payload) };
    }

    return options;
};

server.rules(processor, {
    validate: { schema: validateSchema }
});

server.route({
    method: 'GET',
    path: '/',
    rules: {
        auth: 'jwt',
        myCustomPre: ['arg1', 'arg2'],
        payload: { a: Joi.boolean(), b: Joi.string() }
    },
    options: {
        id: 'my-route'
    }
});
```

### <a name="server.start()" /> `await server.start()`

Starts the server by listening for incoming requests on the configured port (unless the connection
was configured with [`autoListen`](#server.options.autoListen) set to `false`).

Return value: none.

Note that if the method fails and throws an error, the server is considered to be in an undefined
state and should be shut down. In most cases it would be impossible to fully recover as the various
plugins, caches, and other event listeners will get confused by repeated attempts to start the
server or make assumptions about the healthy state of the environment. It is recommended to abort
the process when the server fails to start properly. If you must try to resume after an error, call
[`server.stop()`](#server.stop()) first to reset the server state.

If a started server is started again, the second call to `server.start()` is ignored. No events
will be emitted and no extension points invoked.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    await server.start();
    console.log('Server started at: ' + server.info.uri);
}
```

### <a name="server.state()" /> `server.state(name, [options])`

[HTTP state management](https://tools.ietf.org/html/rfc6265) uses client cookies to persist a state
across multiple requests. Registers a cookie definitions where:

- `name` - the cookie name string.

- `options` - are the optional cookie settings:

    - `ttl` - time-to-live in milliseconds. Defaults to `null` (session time-life - cookies are deleted when the browser is closed).

    - `isSecure` - sets the 'Secure' flag. Defaults to `true`.

    - `isHttpOnly` - sets the 'HttpOnly' flag. Defaults to `true`.

    - `isSameSite` - sets the ['SameSite' flag](https://www.owasp.org/index.php/SameSite).  The value must be one of:

        - `false` - no flag.
        - `'Strict'` - sets the value to `'Strict'` (this is the default value).
        - `'Lax'` - sets the value to `'Lax'`.
        - `'None'` - sets the value to `'None'`.

    - `path` - the path scope. Defaults to `null` (no path).

    - `domain` - the domain scope. Defaults to `null` (no domain).

    - `autoValue` - if present and the cookie was not received from the client or explicitly set by the route handler, the cookie is automatically added to the response with the provided value. The value can be a function with signature `async function(request)` where:

        - `request` - the [request object](#request).

    - `encoding` - encoding performs on the provided value before serialization. Options are:

        - `'none'` - no encoding. When used, the cookie value must be a string. This is the default value.
        - `'base64'` - string value is encoded using Base64.
        - `'base64json'` - object value is JSON-stringified then encoded using Base64.
        - `'form'` - object value is encoded using the _x-www-form-urlencoded_ method.
        - `'iron'` - Encrypts and sign the value using [**iron**](https://hapi.dev/family/iron/api).

    - `sign` - an object used to calculate an HMAC for cookie integrity validation. This does not provide privacy, only a mean to verify that the cookie value was generated by the server. Redundant when `'iron'` encoding is used. Options are:

        - `integrity` - algorithm options. Defaults to [`require('iron').defaults.integrity`](https://hapi.dev/family/iron/api/#options).
        - `password` - password used for HMAC key generation (must be at least 32 characters long).

    - `password` - password used for `'iron'` encoding (must be at least 32 characters long).

    - `iron` - options for `'iron'` encoding. Defaults to [`require('iron').defaults`](https://hapi.dev/family/iron/api/#options).

    - `ignoreErrors` - if `true`, errors are ignored and treated as missing cookies.

    - `clearInvalid` - if `true`, automatically instruct the client to remove invalid cookies. Defaults to `false`.

    - `strictHeader` - if `false`, allows any cookie value including values in violation of [RFC 6265](https://tools.ietf.org/html/rfc6265). Defaults to `true`.

    - `passThrough` - used by proxy plugins (e.g. [**h2o2**](https://hapi.dev/family/h2o2/api)).

    - `contextualize` - a function using the signature `async function(definition, request)` used to override a request-specific cookie settings where:

        - `definition` - a copy of the `options` to be used for formatting the cookie that can be manipulated by the function to customize the request cookie header. Note that changing the `definition.contextualize` property will be ignored.
        - `request` - the current request object.

Return value: none.

State defaults can be modified via the [server.options.state](#server.options.state) configuration
option.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

// Set cookie definition

server.state('session', {
    ttl: 24 * 60 * 60 * 1000,     // One day
    isSecure: true,
    path: '/',
    encoding: 'base64json'
});

// Set state in route handler

const handler = function (request, h) {

    let session = request.state.session;
    if (!session) {
        session = { user: 'joe' };
    }

    session.last = Date.now();

    return h.response('Success').state('session', session);
};
```

Registered cookies are automatically parsed when received. Parsing rules depends on the route
[`state.parse`](#route.options.state) configuration. If an incoming registered cookie fails parsing,
it is not included in [`request.state`](#request.state), regardless of the
[`state.failAction`](#route.options.state.failAction) setting. When [`state.failAction`](#route.options.state.failAction)
is set to `'log'` and an invalid cookie value is received, the server will emit a
[`'request'` event](#server.events.request). To capture these errors subscribe to the `'request'`
event on the `'internal'` channel and filter on `'error'` and `'state'` tags:

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

    if (tags.error && tags.state) {
        console.error(event);
    }
});
```

### <a name="server.states.add()" /> `server.states.add(name, [options])`

Access: read only.

Same as calling [`server.state()`](#server.state()).

### <a name="server.states.format()" /> `await server.states.format(cookies)`

Formats an HTTP 'Set-Cookie' header based on the [`server.options.state`](#server.options.state)
where:

- `cookies` - a single object or an array of object where each contains:
    - `name` - the cookie name.
    - `value` - the cookie value.
    - `options` - cookie configuration to override the server settings.

Return value: a header string.

Note that this utility uses the server configuration but does not change the server state. It is
provided for manual cookie formatting (e.g. when headers are set manually).

### <a name="server.states.parse()" /> `await server.states.parse(header)`

Parses an HTTP 'Cookies' header based on the [`server.options.state`](#server.options.state) where:

- `header` - the HTTP header.

Return value: an object where each key is a cookie name and value is the parsed cookie.

Note that this utility uses the server configuration but does not change the server state. It is
provided for manual cookie parsing (e.g. when server parsing is disabled).

### <a name="server.stop()" /> `await server.stop([options])`

Stops the server's listener by refusing to accept any new connections or requests (existing
connections will continue until closed or timeout), where:

- `options` - (optional) object with:

    - `timeout` - sets the timeout in millisecond before forcefully terminating any open
      connections that arrived before the server stopped accepting new connections. The timeout
      only applies to waiting for existing connections to close, and not to any
      [`'onPreStop'` or `'onPostStop'` server extensions](#server.ext.args()) which can
      delay or block the stop operation indefinitely. Ignored if
      [`server.options.operations.cleanStop`](#server.options.operations) is `false`. Note that if
      the server is set as a [group controller](#server.control()), the timeout is per controlled
      server and the controlling server itself. Defaults to `5000` (5 seconds).

Return value: none.

```js
const Hapi = require('@hapi/hapi');

async function example() {

    const server = Hapi.server({ port: 80 });
    await server.start();
    await server.stop({ timeout: 60 * 1000 });
    console.log('Server stopped');
}
```

### <a name="server.table()" /> `server.table([host])`

Returns a copy of the routing table where:

- `host` - (optional) host to filter routes matching a specific virtual host. Defaults to all
  virtual hosts.

Return value: an array of routes where each route contains:
- `settings` - the route config with defaults applied.
- `method` - the HTTP method in lower case.
- `path` - the route path.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });
server.route({ method: 'GET', path: '/example', handler: () => 'ok' });

const table = server.table();
```

### <a name="server.validator()" /> `server.validator(validator)`

Registers a server validation module used to compile raw validation rules into validation schemas for all routes where:

- `validator` - the validation module (e.g. **joi**).

Return value: none.

Note: the validator is only used when validation rules are not pre-compiled schemas. When a validation rules is a function or schema object, the rule is used as-is and the validator is not used. When setting a validator inside a plugin, the validator is only applied to routes set up by the plugin and plugins registered by it.

```js
const Hapi = require('@hapi/hapi');
const Joi = require('joi');

async function example() {

    const server = Hapi.server({ port: 80 });
    server.validator(Joi);
}
```

## Route options

Each route can be customized to change the default behavior of the request lifecycle.

### <a name="route.options.app" /> `route.options.app`

Application-specific route configuration state. Should not be used by [plugins](#plugins) which
should use `options.plugins[name]` instead.

### <a name="route.options.auth" /> `route.options.auth`

Route authentication configuration. Value can be:

- `false` to disable authentication if a default strategy is set.

- a string with the name of an authentication strategy registered with
  [`server.auth.strategy()`](#server.auth.strategy()). The strategy will be
  set to `'required'` mode.

- an [authentication configuration object](#authentication-options).

#### <a name="route.options.auth.access" /> `route.options.auth.access`

Default value: none.

An object or array of objects specifying the route access rules. Each rule is evaluated against an
incoming request and access is granted if at least one of the rules matches. Each rule object must
include at least one of [`scope`](#route.options.auth.access.scope) or
[`entity`](#route.options.auth.access.entity).

#### <a name="route.options.auth.access.scope" /> `route.options.auth.access.scope`

Default value: `false` (no scope requirements).

The application scope required to access the route. Value can be a scope string or an
array of scope strings. When authenticated, the credentials object `scope` property must contain
at least one of the scopes defined to access the route.

If a scope string begins with a `+` character, that scope is required. If a scope string begins
with a `!` character, that scope is forbidden. For example, the scope `['!a', '+b', 'c', 'd']`
means the incoming request credentials' `scope` must not include 'a', must include 'b', and must
include one of 'c' or 'd'.

You may also access properties on the request object (`query`, `params`, `payload`, and
`credentials`) to populate a dynamic scope by using the '{' and '}' characters around the property
name, such as `'user-{params.id}'`.

#### <a name="route.options.auth.access.entity" /> `route.options.auth.access.entity`

Default value: `'any'`.

The required authenticated entity type. If set, must match the `entity` value of the request
authenticated credentials. Available values:

- `'any'` - the authentication can be on behalf of a user or application.
- `'user'` - the authentication must be on behalf of a user which is identified by the presence of
  a `'user'` attribute in the `credentials` object returned by the authentication strategy.
- `'app'` - the authentication must be on behalf of an application which is identified by the lack
  of presence of a `user` attribute in the `credentials` object returned by the authentication
  strategy.

#### <a name="route.options.auth.mode" /> `route.options.auth.mode`

Default value: `'required'`.

The authentication mode. Available values:

- `'required'` - authentication is required.
- `'optional'` - authentication is optional - the request must include valid credentials or no
  credentials at all.
- `'try'` - similar to `'optional'`, any request credentials are attempted authentication, but if
  the credentials are invalid, the request proceeds regardless of the authentication error.

#### <a name="route.options.auth.payload" /> `route.options.auth.payload`

Default value: `false`, unless the scheme requires payload authentication.

If set, the incoming request payload is authenticated after it is processed. Requires a strategy
with payload authentication support (e.g. [Hawk](https://hapi.dev/family/hawk/api)). Cannot be
set to a value other than `'required'` when the scheme sets the authentication `options.payload` to
`true`.

Available values:

- `false` - no payload authentication.
- `'required'` - payload authentication required.
- `'optional'` - payload authentication performed only when the client includes payload
  authentication information (e.g. `hash` attribute in Hawk).

#### <a name="route.options.auth.strategies" /> `route.options.auth.strategies`

Default value: the default strategy set via [`server.auth.default()`](#server.auth.default()).

An array of string strategy names in the order they should be attempted. Cannot be used together
with [`strategy`](#route.options.auth.strategy).

#### <a name="route.options.auth.strategy" /> `route.options.auth.strategy`

Default value: the default strategy set via [`server.auth.default()`](#server.auth.default()).

A string strategy names. Cannot be used together with [`strategies`](#route.options.auth.strategies).

### <a name="route.options.bind" /> `route.options.bind`

Default value: `null`.

An object passed back to the provided `handler` (via `this`) when called. Ignored if the method is
an arrow function.

### <a name="route.options.cache" /> `route.options.cache`

Default value: `{ privacy: 'default', statuses: [200], otherwise: 'no-cache' }`.

If the route method is 'GET', the route can be configured to include HTTP caching directives in the
response. Caching can be customized using an object with the following options:

- `privacy` - determines the privacy flag included in client-side caching using the 'Cache-Control'
  header. Values are:

    - `'default'` - no privacy flag.
    - `'public'` - mark the response as suitable for public caching.
    - `'private'` - mark the response as suitable only for private caching.

- `expiresIn` - relative expiration expressed in the number of milliseconds since the
  item was saved in the cache. Cannot be used together with `expiresAt`.

- `expiresAt` - time of day expressed in 24h notation using the 'HH:MM' format, at which
  point all cache records for the route expire. Cannot be used together with `expiresIn`.

- `statuses` - an array of HTTP response status code numbers (e.g. `200`) which are allowed to
  include a valid caching directive.

- `otherwise` - a string with the value of the 'Cache-Control' header when caching is disabled.

The default `Cache-Control: no-cache` header can be disabled by setting `cache` to `false`.

### <a name="route.options.compression" /> `route.options.compression`

An object where each key is a content-encoding name and each value is an object with the desired
encoder settings. Note that decoder settings are set in [`compression`](#route.options.payload.compression).

### <a name="route.options.cors" /> `route.options.cors`

Default value: `false` (no CORS headers).

The [Cross-Origin Resource Sharing](https://www.w3.org/TR/cors/) protocol allows browsers to make
cross-origin API calls. CORS is required by web applications running inside a browser which are
loaded from a different domain than the API server. To enable, set `cors` to `true`, or to an
object with the following options:

- `origin` - an array of allowed origin servers strings ('Access-Control-Allow-Origin'). The array
  can contain any combination of fully qualified origins along with origin strings containing a
  wildcard `'*'` character, or a single `'*'` origin string. If set to `'ignore'`, any incoming
  Origin header is ignored (present or not) and the 'Access-Control-Allow-Origin' header is set to
  `'*'`. Defaults to any origin `['*']`.

- `maxAge` - number of seconds the browser should cache the CORS response
  ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser
  checks for changes in policy. Defaults to `86400` (one day).

- `headers` - a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to
  `['Accept', 'Authorization', 'Content-Type', 'If-None-Match']`.

- `additionalHeaders` - a strings array of additional headers to `headers`. Use this to keep the
  default headers in place.

- `exposedHeaders` - a strings array of exposed headers ('Access-Control-Expose-Headers').
  Defaults to `['WWW-Authenticate', 'Server-Authorization']`.

- `additionalExposedHeaders` - a strings array of additional headers to `exposedHeaders`. Use this
  to keep the default headers in place.

- `credentials` - if `true`, allows user credentials to be sent
  ('Access-Control-Allow-Credentials'). Defaults to `false`.

### <a name="route.options.description" /> `route.options.description`

Default value: none.

Route description used for generating documentation (string).

This setting is not available when setting server route defaults using
[`server.options.routes`](#server.options.routes).

### <a name="route.options.ext" /> `route.options.ext`

Default value: none.

Route-level [request extension points](#request-lifecycle) by setting the option to an object with
a key for each of the desired extension points (`'onRequest'` is not allowed), and the value is the
same as the [`server.ext(events)`](#server.ext()) `event` argument.

### <a name="route.options.files" /> `route.options.files`

Default value: `{ relativeTo: '.' }`.

Defines the behavior for accessing files:

- `relativeTo` - determines the folder relative paths are resolved against.

### <a name="route.options.handler" /> `route.options.handler`

Default value: none.

The route handler function performs the main business logic of the route and sets the response.
`handler` can be assigned:

- a [lifecycle method](#lifecycle-methods).

- an object with a single property using the name of a handler type registered with the
  [`server.decorate()`](#server.decorate()) method. The matching property value is passed
  as options to the registered handler generator.

```js
const handler = function (request, h) {

    return 'success';
};
```

Note: handlers using a fat arrow style function cannot be bound to any `bind` property. Instead,
the bound context is available under [`h.context`](#h.context).

### <a name="route.options.id" /> `route.options.id`

Default value: none.

An optional unique identifier used to look up the route using [`server.lookup()`](#server.lookup()).
Cannot be assigned to routes added with an array of methods.

### <a name="route.options.isInternal" /> `route.options.isInternal`

Default value: `false`.

If `true`, the route cannot be accessed through the HTTP listener but only through the
[`server.inject()`](#server.inject()) interface with the `allowInternals` option set to `true`.
Used for internal routes that should not be accessible to the outside world.

### <a name="route.options.json" /> `route.options.json`

Default value: none.

Optional arguments passed to `JSON.stringify()` when converting an object or error response to a
string payload or escaping it after stringification. Supports the following:

- `replacer` - the replacer function or array. Defaults to no action.

- `space` - number of spaces to indent nested object keys. Defaults to no indentation.

- `suffix` - string suffix added after conversion to JSON string. Defaults to no suffix.

- `escape` - calls [`Hoek.jsonEscape()`](https://hapi.dev/family/hoek/api/#escapejsonstring)
  after conversion to JSON string. Defaults to `false`.

### <a name="route.options.jsonp" /> `route.options.jsonp`

Default value: none.

Enables JSONP support by setting the value to the query parameter name containing the function name
used to wrap the response payload.

For example, if the value is `'callback'`, a request comes in with `'callback=me'`, and the JSON
response is `'{ "a":"b" }'`, the payload will be `'me({ "a":"b" });'`. Cannot be used with stream
responses.

The 'Content-Type' response header is set to `'text/javascript'` and the 'X-Content-Type-Options'
response header is set to `'nosniff'`, and will override those headers even if explicitly set by
[`response.type()`](#response.type()).

### <a name="route.options.log" /> `route.options.log`

Default value: `{ collect: false }`.

Request logging options:

- `collect` - if `true`, request-level logs (both internal and application) are collected and
  accessible via [`request.logs`](#request.logs).

### <a name="route.options.notes" /> `route.options.notes`

Default value: none.

Route notes used for generating documentation (string or array of strings).

This setting is not available when setting server route defaults using
[`server.options.routes`](#server.options.routes).

### <a name="route.options.payload" /> `route.options.payload`

Determines how the request payload is processed.

#### <a name="route.options.payload.allow" /> `route.options.payload.allow`

Default value: allows parsing of the following mime types:
- application/json
- application/*+json
- application/octet-stream
- application/x-www-form-urlencoded
- multipart/form-data
- text/*

A string or an array of strings with the allowed mime types for the endpoint. Use this settings to
limit the set of allowed mime types. Note that allowing additional mime types not listed above will
not enable them to be parsed, and if [`parse`](#route.options.payload.parse) is `true`, the request
will result in an error response.

#### <a name="route.options.payload.compression" /> `route.options.payload.compression`

Default value: none.

An object where each key is a content-encoding name and each value is an object with the desired
decoder settings. Note that encoder settings are set in [`compression`](#server.options.compression).

#### <a name="route.options.payload.defaultContentType" /> `route.options.payload.defaultContentType`

Default value: `'application/json'`.

The default content type if the 'Content-Type' request header is missing.

#### <a name="route.options.payload.failAction" /> `route.options.payload.failAction`

Default value: `'error'` (return a Bad Request (400) error response).

A [`failAction` value](#lifecycle-failAction) which determines how to handle payload parsing
errors.

#### <a name="route.options.payload.maxBytes" /> `route.options.payload.maxBytes`

Default value: `1048576` (1MB).

Limits the size of incoming payloads to the specified byte count. Allowing very large payloads may
cause the server to run out of memory.

#### <a name="route.options.payload.multipart" /> `route.options.payload.multipart`

Default value: `false`.

Overrides payload processing for multipart requests. Value can be one of:

- `false` - disable multipart processing (this is the default value).

- `true` - enable multipart processing using the [`output`](#route.options.payload.output) value.

- an object with the following required options:

    - `output` - same as the [`output`](#route.options.payload.output) option with an additional
      value option:
        - `annotated` - wraps each multipart part in an object with the following keys:

            - `headers` - the part headers.
            - `filename` - the part file name.
            - `payload` - the processed part payload.

#### <a name="route.options.payload.output" /> `route.options.payload.output`

Default value: `'data'`.

The processed payload format. The value must be one of:

- `'data'` - the incoming payload is read fully into memory. If [`parse`](#route.options.payload.parse)
  is `true`, the payload is parsed (JSON, form-decoded, multipart) based on the 'Content-Type'
  header. If [`parse`](#route.options.payload.parse) is `false`, a raw `Buffer` is returned.

- `'stream'` - the incoming payload is made available via a `Stream.Readable` interface. If the
  payload is 'multipart/form-data' and [`parse`](#route.options.payload.parse) is `true`, field
  values are presented as text while files are provided as streams. File streams from a
  'multipart/form-data' upload will also have a `hapi` property containing the `filename` and
  `headers` properties. Note that payload streams for multipart payloads are a synthetic interface
  created on top of the entire multipart content loaded into memory. To avoid loading large
  multipart payloads into memory, set [`parse`](#route.options.payload.parse) to `false` and handle
  the multipart payload in the handler using a streaming parser (e.g. [**pez**](https://hapi.dev/family/pez/api)).

- `'file'` - the incoming payload is written to temporary file in the directory specified by the
  [`uploads`](#route.options.payload.uploads) settings. If the payload is 'multipart/form-data' and
  [`parse`](#route.options.payload.parse) is `true`, field values are presented as text while files
  are saved to disk. Note that it is the sole responsibility of the application to clean up the
  files generated by the framework. This can be done by keeping track of which files are used (e.g.
  using the `request.app` object), and listening to the server `'response'` event to perform
  cleanup.

#### <a name="route.options.payload.override" /> `route.options.payload.override`

Default value: none.

A mime type string overriding the 'Content-Type' header value received.

#### <a name="route.options.payload.parse" /> `route.options.payload.parse`

Default value: `true`.

Determines if the incoming payload is processed or presented raw. Available values:

- `true` - if the request 'Content-Type' matches the allowed mime types set by
  [`allow`](#route.options.payload.allow) (for the whole payload as well as parts), the payload is
  converted into an object when possible. If the format is unknown, a Bad Request (400) error
  response is sent. Any known content encoding is decoded.

- `false` - the raw payload is returned unmodified.

- `'gunzip'` - the raw payload is returned unmodified after any known content encoding is decoded.

#### <a name="route.options.payload.protoAction" /> `route.options.payload.protoAction`

Default value: `'error'`.

Sets handling of incoming payload that may contain a prototype poisoning security attack. Available
values:

- `'error'` - returns a `400` bad request error when the payload contains a prototype.

- `'remove'` - sanitizes the payload to remove the prototype.

- `'ignore'` - disables the protection and allows the payload to pass as received. Use this option
  only when you are sure that such incoming data cannot pose any risks to your application.

#### <a name="route.options.payload.timeout" /> `route.options.payload.timeout`

Default value: to `10000` (10 seconds).

Payload reception timeout in milliseconds. Sets the maximum time allowed for the client to transmit
the request payload (body) before giving up and responding with a Request Timeout (408) error
response.

Set to `false` to disable.

#### <a name="route.options.payload.uploads" /> `route.options.payload.uploads`

Default value: `os.tmpdir()`.

The directory used for writing file uploads.

### <a name="route.options.plugins" /> `route.options.plugins`

Default value: `{}`.

Plugin-specific configuration. `plugins` is an object where each key is a plugin name and the value
is the plugin configuration.

### <a name="route.options.pre" /> `route.options.pre`

Default value: none.

The `pre` option allows defining methods for performing actions before the handler is called. These
methods allow breaking the handler logic into smaller, reusable components that can be shared
across routes, as well as provide a cleaner error handling of prerequisite operations (e.g. load
required reference data from a database).

`pre` is assigned an ordered array of methods which are called serially in order. If the `pre`
array contains another array of methods as one of its elements, those methods are called in
parallel. Note that during parallel execution, if any of the methods error, return a
[takeover response](#takeover-response), or abort signal, the other parallel methods will continue
to execute but will be ignored once completed.

`pre` can be assigned a mixed array of:

- an array containing the elements listed below, which are executed in parallel.

- an object with:
    - `method` - a [lifecycle method](#lifecycle-methods).
    - `assign` - key name used to assign the response of the method to in [`request.pre`](#request.pre)
      and [`request.preResponses`](#request.preResponses).
    - `failAction` - A [`failAction` value](#lifecycle-failAction) which determine what to do when
      a pre-handler method throws an error. If `assign` is specified and the `failAction` setting
      is not `'error'`, the error will be assigned.

- a method function - same as including an object with a single `method` key.

Note that pre-handler methods do not behave the same way other [lifecycle methods](#lifecycle-methods)
do when a value is returned. Instead of the return value becoming the new response payload, the
value is used to assign the corresponding [`request.pre`](#request.pre) and
[`request.preResponses`](#request.preResponses) properties. Otherwise, the handling of errors,
[takeover response](#takeover-response) response, or abort signal behave the same as any other
[lifecycle methods](#lifecycle-methods).

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const pre1 = function (request, h) {

    return 'Hello';
};

const pre2 = function (request, h) {

    return 'World';
};

const pre3 = function (request, h) {

    return request.pre.m1 + ' ' + request.pre.m2;
};

server.route({
    method: 'GET',
    path: '/',
    options: {
        pre: [
            [
                // m1 and m2 executed in parallel
                { method: pre1, assign: 'm1' },
                { method: pre2, assign: 'm2' }
            ],
            { method: pre3, assign: 'm3' },
        ],
        handler: function (request, h) {

            return request.pre.m3 + '!\n';
        }
    }
});
```

### <a name="route.options.response" /> `route.options.response`

Processing rules for the outgoing response.

#### <a name="route.options.response.disconnectStatusCode" /> `route.options.response.disconnectStatusCode`

 Default value: `499`.

The default HTTP status code used to set a response error when the request is closed or aborted
before the response is fully transmitted. Value can be any integer greater or equal to `400`. The
default value `499` is based on the non-standard nginx "CLIENT CLOSED REQUEST" error. The value is
only used for logging as the request has already ended.

#### <a name="route.options.response.emptyStatusCode" /> `route.options.response.emptyStatusCode`

 Default value: `204`.

The default HTTP status code when the payload is considered empty. Value can be `200` or `204`.
Note that a `200` status code is converted to a `204` only at the time of response transmission
(the response status code will remain `200` throughout the request lifecycle unless manually set).

#### <a name="route.options.response.failAction" /> `route.options.response.failAction`

Default value: `'error'` (return an Internal Server Error (500) error response).

A [`failAction` value](#lifecycle-failAction) which defines what to do when a response fails
payload validation.

#### <a name="route.options.response.modify" /> `route.options.response.modify`

Default value: `false`.

If `true`, applies the validation rule changes to the response payload.

#### <a name="route.options.response.options" /> `route.options.response.options`

Default value: none.

[**joi**](https://joi.dev/api) options object pass to the validation function. Useful to set global options such as `stripUnknown` or `abortEarly`. If a custom validation function is defined via [`schema`](#route.options.response.schema) or [`status`](#route.options.response.status) then `options` can an arbitrary object that will be passed to this function as the second argument.

#### <a name="route.options.response.ranges" /> `route.options.response.ranges`

Default value: `true`.

If `false`, payload [range](https://tools.ietf.org/html/rfc7233#section-3) support is disabled.

#### <a name="route.options.response.sample" /> `route.options.response.sample`

Default value: `100` (all responses).

The percent of response payloads validated (0 - 100). Set to `0` to disable all validation.

#### <a name="route.options.response.schema" /> `route.options.response.schema`

Default value: `true` (no validation).

The default response payload validation rules (for all non-error responses) expressed as one of:

- `true` - any payload allowed (no validation).

- `false` - no payload allowed.

- a [**joi**](https://joi.dev/api) validation object. The [`options`](#route.options.response.options)
  along with the request context (`{ headers, params, query, payload, state, app, auth }`) are passed to
  the validation function.

- a validation function using the signature `async function(value, options)` where:

    - `value` - the pending response payload.
    - `options` - The [`options`](#route.options.response.options) along with the request context
      (`{ headers, params, query, payload, state, app, auth }`).

    - if the function returns a value and [`modify`](#route.options.response.modify) is `true`,
      the value is used as the new response. If the original response is an error, the return
      value is used to override the original error `output.payload`. If an error is thrown, the
      error is processed according to [`failAction`](#route.options.response.failAction).

#### <a name="route.options.response.status" /> `route.options.response.status`

Default value: none.

Validation schemas for specific HTTP status codes. Responses (excluding errors) not matching the
listed status codes are validated using the default [`schema`](#route.options.response.schema).

`status` is set to an object where each key is a 3 digit HTTP status code and the value has the
same definition as [`schema`](#route.options.response.schema).

### <a name="route.options.rules" /> `route.options.rules`

Default value: none.

A custom rules object passed to each rules processor registered with [`server.rules()`](#server.rules()).

### <a name="route.options.security" /> `route.options.security`

Default value: `false` (security headers disabled).

Sets common security headers. To enable, set `security` to `true` or to an object with the
following options:

- `hsts` - controls the 'Strict-Transport-Security' header, where:

    - `true` - the header will be set to `max-age=15768000`. This is the default value.
    - a number - the maxAge parameter will be set to the provided value.

    - an object with the following fields:
        - `maxAge` - the max-age portion of the header, as a number. Default is `15768000`.
        - `includeSubDomains` - a boolean specifying whether to add the `includeSubDomains` flag to
          the header.
        - `preload` - a boolean specifying whether to add the `'preload'` flag (used to submit
          domains inclusion in Chrome's HTTP Strict Transport Security (HSTS) preload list) to the
          header.

- `xframe` - controls the 'X-Frame-Options' header, where:

    - `true` - the header will be set to `'DENY'`. This is the default value.
    - `'deny'` - the headers will be set to `'DENY'`.
    - `'sameorigin'` - the headers will be set to `'SAMEORIGIN'`.

    - an object for specifying the 'allow-from' rule, where:
        - `rule` - one of:
            - `'deny'`
            - `'sameorigin'`
            - `'allow-from'`
        - `source` - when `rule` is `'allow-from'` this is used to form the rest of the header,
          otherwise this field is ignored. If `rule` is `'allow-from'` but `source` is unset, the
          rule will be automatically changed to `'sameorigin'`.

- `xss` - boolean that controls the 'X-XSS-PROTECTION' header for Internet Explorer. Defaults to
  `true` which sets the header to equal `'1; mode=block'`.
    - Note: this setting can create a security vulnerability in versions of Internet Exploere below
      8, as well as unpatched versions of IE8. See [here](https://hackademix.net/2009/11/21/ies-xss-filter-creates-xss-vulnerabilities/)
      and [here](https://technet.microsoft.com/library/security/ms10-002) for more information. If
      you actively support old versions of IE, it may be wise to explicitly set this flag to
      `false`.

- `noOpen` - boolean controlling the 'X-Download-Options' header for Internet Explorer, preventing
  downloads from executing in your context. Defaults to `true` setting the header to `'noopen'`.

- `noSniff` - boolean controlling the 'X-Content-Type-Options' header. Defaults to `true` setting
  the header to its only and default option, `'nosniff'`.

- `referrer` - controls the ['Referrer-Policy'](https://www.w3.org/TR/referrer-policy/) header, which has the following possible values.
    - `false` - the 'Referrer-Policy' header will not be sent to clients with responses. This is the default value.
    - `''` - instructs clients that the Referrer-Policy will be [defined elsewhere](https://www.w3.org/TR/referrer-policy/#referrer-policy-empty-string), such as in a meta html tag.
    - `'no-referrer'` - instructs clients to never include the referrer header when making requests.
    - `'no-referrer-when-downgrade'` - instructs clients to never include the referrer when navigating from HTTPS to HTTP.
    - `'same-origin'` - instructs clients to only include the referrer on the current site origin.
    - `'origin'` - instructs clients to include the referrer but strip off path information so that the value is the current origin only.
    - `'strict-origin'` - same as `'origin'` but instructs clients to omit the referrer header when going from HTTPS to HTTP.
    - `'origin-when-cross-origin'` - instructs clients to include the full path in the referrer header for same-origin requests but only the origin components of the URL are included for cross origin requests.
    - `'strict-origin-when-cross-origin'` - same as `'origin-when-cross-origin'` but the client is instructed to omit the referrer when going from HTTPS to HTTP.
    - `'unsafe-url'` - instructs the client to always include the referrer with the full URL.

### <a name="route.options.state" /> `route.options.state`

Default value: `{ parse: true, failAction: 'error' }`.

HTTP state management (cookies) allows the server to store information on the client which is sent
back to the server with every request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)).
`state` supports the following options:

- `parse` - determines if incoming 'Cookie' headers are parsed and stored in the
  [`request.state`](#request.state) object.

- `failAction` - A [`failAction` value](#lifecycle-failAction) which determines how to handle
  cookie parsing errors. Defaults to `'error'` (return a Bad Request (400) error response).

### <a name="route.options.tags" /> `route.options.tags`

Default value: none.

Route tags used for generating documentation (array of strings).

This setting is not available when setting server route defaults using
[`server.options.routes`](#server.options.routes).

### <a name="route.options.timeout" /> `route.options.timeout`

Default value: `{ server: false }`.

Timeouts for processing durations.

#### <a name="route.options.timeout.server" /> `route.options.timeout.server`

Default value: `false`.

Response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an
incoming request before giving up and responding with a Service Unavailable (503) error response.

#### <a name="route.options.timeout.socket" /> `route.options.timeout.socket`

Default value: none (use node default of 2 minutes).

By default, node sockets automatically timeout after 2 minutes. Use this option to override this
behavior. Set to `false` to disable socket timeouts.

### <a name="route.options.validate" /> `route.options.validate`

Default value: `{ headers: true, params: true, query: true, payload: true, state: true, failAction: 'error' }`.

Request input validation rules for various request components.

#### <a name="route.options.validate.errorFields" /> `route.options.validate.errorFields`

Default value: none.

An optional object with error fields copied into every validation error response.

#### <a name="route.options.validate.failAction" /> `route.options.validate.failAction`

Default value: `'error'` (return a Bad Request (400) error response).

A [`failAction` value](#lifecycle-failAction) which determines how to handle failed validations.
When set to a function, the `err` argument includes the type of validation error under
`err.output.payload.validation.source`.

#### <a name="route.options.validate.headers" /> `route.options.validate.headers`

Default value: `true` (no validation).

Validation rules for incoming request headers:

- `true` - any headers allowed (no validation performed).

- a [**joi**](https://joi.dev/api) validation object.

- a validation function using the signature `async function(value, options)` where:

    - `value` - the [`request.headers`](#request.headers) object containing the request headers.
    - `options` - [`options`](#route.options.validate.options).
    - if a value is returned, the value is used as the new [`request.headers`](#request.headers)
      value and the original value is stored in [`request.orig.headers`](#request.orig).
      Otherwise, the headers are left unchanged. If an error is thrown, the error is handled
      according to [`failAction`](#route.options.validate.failAction).

Note that all header field names must be in lowercase to match the headers normalized by node.

#### <a name="route.options.validate.options" /> `route.options.validate.options`

Default value: none.

An options object passed to the [**joi**](https://joi.dev/api) rules or the custom
validation methods. Used for setting global options such as `stripUnknown` or `abortEarly`.

If a custom validation function (see `headers`, `params`, `query`, or `payload` above) is defined
then `options` can an arbitrary object that will be passed to this function as the second
parameter.

The values of the other inputs (i.e. `headers`, `query`, `params`, `payload`, `state`, `app`, and `auth`)
are added to the `options` object under the validation `context` (accessible in rules as
`Joi.ref('$query.key')`).

Note that validation is performed in order (i.e. headers, params, query, and payload) and if type
casting is used (e.g. converting a string to a number), the value of inputs not yet validated will
reflect the raw, unvalidated and unmodified values.

If the validation rules for `headers`, `params`, `query`, and `payload` are defined at both the
server [`routes`](#server.options.routes) level and at the route level, the individual route
settings override the routes defaults (the rules are not merged).

#### <a name="route.options.validate.params" /> `route.options.validate.params`

Default value: `true` (no validation).

Validation rules for incoming request path parameters, after matching the path against the route,
extracting any parameters, and storing them in [`request.params`](#request.params), where:

- `true` - any path parameter value allowed (no validation performed).

- a [**joi**](https://joi.dev/api) validation object.

- a validation function using the signature `async function(value, options)` where:

    - `value` - the [`request.params`](#request.params) object containing the request path
      parameters.
    - `options` - [`options`](#route.options.validate.options).
    - if a value is returned, the value is used as the new [`request.params`](#request.params)
      value and the original value is stored in [`request.orig.params`](#request.orig). Otherwise,
      the path parameters are left unchanged. If an error is thrown, the error is handled according
      to [`failAction`](#route.options.validate.failAction).

Note that failing to match the validation rules to the route path parameters definition will cause
all requests to fail.

#### <a name="route.options.validate.payload" /> `route.options.validate.payload`

Default value: `true` (no validation).

Validation rules for incoming request payload (request body), where:

- `true` - any payload allowed (no validation performed).

- `false` - no payload allowed.

- a [**joi**](https://joi.dev/api) validation object.
    - Note that empty payloads are represented by a `null` value. If a validation schema is
      provided and empty payload are allowed, the schema must be explicitly defined by setting the
      rule to a **joi** schema with `null` allowed (e.g.
      `Joi.object({ /* keys here */ }).allow(null)`).

- a validation function using the signature `async function(value, options)` where:

    - `value` - the [`request.payload`](#request.payload) object containing the request payload.
    - `options` - [`options`](#route.options.validate.options).
    - if a value is returned, the value is used as the new [`request.payload`](#request.payload)
      value and the original value is stored in [`request.orig.payload`](#request.orig). Otherwise,
      the payload is left unchanged. If an error is thrown, the error is handled according to
      [`failAction`](#route.options.validate.failAction).

Note that validating large payloads and modifying them will cause memory duplication of the payload
(since the original is kept), as well as the significant performance cost of validating large
amounts of data.

#### <a name="route.options.validate.query" /> `route.options.validate.query`

Default value: `true` (no validation).

Validation rules for incoming request URI query component (the key-value part of the URI between
'?' and '#'). The query is parsed into its individual key-value pairs, decoded, and stored in
[`request.query`](#request.query) prior to validation. Where:

- `true` - any query parameter value allowed (no validation performed).

- `false` - no query parameter value allowed.

- a [**joi**](https://joi.dev/api) validation object.

- a validation function using the signature `async function(value, options)` where:

    - `value` - the [`request.query`](#request.query) object containing the request query
      parameters.
    - `options` - [`options`](#route.options.validate.options).
    - if a value is returned, the value is used as the new [`request.query`](#request.query) value
      and the original value is stored in [`request.orig.query`](#request.orig). Otherwise, the
      query parameters are left unchanged. If an error is thrown, the error is handled according to
      [`failAction`](#route.options.validate.failAction).

Note that changes to the query parameters will not be reflected in [`request.url`](#request.url).

#### <a name="route.options.validate.state" /> `route.options.validate.state`

Default value: `true` (no validation).

Validation rules for incoming cookies. The `cookie` header is parsed and decoded into the
[`request.state`](#request.state) prior to validation. Where:

- `true` - any cookie value allowed (no validation performed).

- `false` - no cookies allowed.

- a [**joi**](https://joi.dev/api) validation object.

- a validation function using the signature `async function(value, options)` where:

    - `value` - the [`request.state`](#request.state) object containing all parsed cookie values.
    - `options` - [`options`](#route.options.validate.options).
    - if a value is returned, the value is used as the new [`request.state`](#request.state) value
      and the original value is stored in [`request.orig.state`](#request.orig). Otherwise, the
      cookie values are left unchanged. If an error is thrown, the error is handled according to
      [`failAction`](#route.options.validate.failAction).

#### <a name="route.options.validate.validator" /> `route.options.validate.validator`

Default value: `null` (no default validator).

Sets a server validation module used to compile raw validation rules into validation schemas (e.g. **joi**).

Note: the validator is only used when validation rules are not pre-compiled schemas. When a validation rules is a function or schema object, the rule is used as-is and the validator is not used.

## Request lifecycle

Each incoming request passes through the request lifecycle. The specific steps vary based on the
server and route configurations, but the order in which the applicable steps are executed is always
the same. The following is the complete list of steps a request can go through:

- _**onRequest**_
    - always called when `onRequest` extensions exist.
    - the request path and method can be modified via the [`request.setUrl()`](#request.setUrl()) and [`request.setMethod()`](#request.setMethod()) methods. Changes to the request path or method will impact how the request is routed and can be used for rewrite rules.
    - [`request.payload`](#request.payload) is `undefined` and can be overridden with any non-`undefined` value to bypass payload processing.
    - [`request.route`](#request.route) is unassigned.
    - [`request.url`](#request.url) can be `null` if the incoming request path is invalid.
    - [`request.path`](#request.path) can be an invalid path.
    - JSONP configuration is ignored for any response returned from the extension point since no
      route is matched yet and the JSONP configuration is unavailable.

- _**Route lookup**_
    - lookup based on `request.path` and `request.method`.
    - skips to _**onPreResponse**_ if no route is found or if the path violates the HTTP
      specification.

- _**JSONP processing**_
    - based on the route [`jsonp`](#route.options.jsonp) option.
    - parses JSONP parameter from [`request.query`](#request.query).
    - skips to _**Response validation**_ on error.

- _**Cookies processing**_
    - based on the route [`state`](#route.options.state) option.
    - error handling based on [`failAction`](#route.options.state.failAction).

- _**onPreAuth**_
    - called regardless if authentication is performed.

- _**Authentication**_
    - based on the route [`auth`](#route.options.auth) option.

- _**Payload processing**_
    - based on the route [`payload`](#route.options.payload) option and if [`request.payload`](#request.payload) has not been overridden in _**onRequest**_.
    - error handling based on [`failAction`](#route.options.payload.failAction).

- _**Payload authentication**_
    - based on the route [`auth`](#route.options.auth) option.

- _**onCredentials**_
    - called only if authentication is performed.

- _**Authorization**_
    - based on the route authentication [`access`](#route.options.auth.access) option.

- _**onPostAuth**_
    - called regardless if authentication is performed.

- _**Headers validation**_
    - based on the route [`validate.headers`](#route.options.validate.headers) option.
    - error handling based on [`failAction`](#route.options.validate.failAction).

- _**Path parameters validation**_
    - based on the route [`validate.params`](#route.options.validate.params) option.
    - error handling based on [`failAction`](#route.options.validate.failAction).

- _**JSONP cleanup**_
    - based on the route [`jsonp`](#route.options.jsonp) option.
    - remove the JSONP parameter from [`request.query`](#request.query).

- _**Query validation**_
    - based on the route [`validate.query`](#route.options.validate.query) option.
    - error handling based on [`failAction`](#route.options.validate.failAction).

- _**Payload validation**_
    - based on the route [`validate.payload`](#route.options.validate.payload) option.
    - error handling based on [`failAction`](#route.options.validate.failAction).

- _**State validation**_
    - based on the route [`validate.state`](#route.options.validate.state) option.
    - error handling based on [`failAction`](#route.options.validate.failAction).

- _**onPreHandler**_

- _**Pre-handler methods**_
    - based on the route [`pre`](#route.options.pre) option.
    - error handling based on each pre-handler method's `failAction` setting.

- _**Route handler**_
    - executes the route [`handler`](#route.options.handler).

- _**onPostHandler**_
    - the response contained in [`request.response`](#request.response) may be modified (but not
      assigned a new value). To return a different response type (for example, replace an error
      with an HTML response), return a new response value.

- _**Response validation**_
    - error handling based on [`failAction`](#route.options.response.failAction).

- _**onPreResponse**_
    - always called, unless the request is aborted.
    - the response contained in [`request.response`](#request.response) may be modified (but not
      assigned a new value). To return a different response type (for example, replace an error
      with an HTML response), return a new response value. Note that any errors generated will not
      be passed back to _**onPreResponse**_ to prevent an infinite loop.

- _**Response transmission**_
    - may emit a [`'request'` event](#server.events.request) on the `'error'` channel.

- _**Finalize request**_
    - emits `'response'` event.

- _**onPostResponse**_
    - return value is ignored since the response is already set.
    - emits a [`'request'` event](#server.events.request) on the `'error'` channel if an error is returned.
    - all extension handlers are executed even if some error.
    - note that since the handlers are executed in serial (each is `await`ed), care must be taken to avoid blocking execution if other extension handlers expect to be called immediately when the response is sent. If an _**onPostResponse**_ handler is performing IO, it should defer that activity to another tick and return immediately (either without a return value or without a promise that is solve to resolve).

### Lifecycle methods

Lifecycle methods are the interface between the framework and the application. Many of the request
lifecycle steps: [extensions](#server.ext()), [authentication](#authentication-scheme),
[handlers](#route.options.handler), [pre-handler methods](#route.options.pre), and
[`failAction` function values](#lifecycle-failAction) are lifecyle methods provided by the
developer and executed by the framework.

Each lifecycle method is a function with the signature `await function(request, h, [err])` where:
- `request` - the [request object](#request).
- `h` - the [response toolkit](#response-toolkit) the handler must call to set a response and
  return control back to the framework.
- `err` - an error object available only when the method is used as a
  [`failAction` value](#lifecycle-failAction).

Each lifecycle method must return a value or a promise that resolves into a value. If a lifecycle
method returns without a value or resolves to an `undefined` value, an Internal Server Error (500)
error response is sent.

The return value must be one of:
- Plain value:
    - `null`
    - string
    - number
    - boolean
- `Buffer` object
- `Error` object
    - plain `Error`.
    - a [`Boom`](https://hapi.dev/family/boom/api) object.
- `Stream` object
    - must be compatible with the "streams2" API and not be in `objectMode`.
    - if the stream object has a `statusCode` property, that status code will be used as
      the default response code based on the [`passThrough`](#response.settings.passThrough)
      option.
    - if the stream object has a `headers` property, the headers will be included in the response
      based on the [`passThrough`](#response.settings.passThrough) option.
    - if the stream object has a function property `setCompressor(compressor)` and the response
      passes through a compressor, a reference to the compressor stream will be passed to the
      response stream via this method.
- any object or array
    - must not include circular references.
- a toolkit signal:
    - [`h.abandon`](#h.abandon) - abort processing the request.
    - [`h.close`](#h.close) - abort processing the request and call `end()` to ensure the response
      is closed.
    - [`h.continue`](#h.continue) - continue processing the request lifecycle without changing the
      response.
- a toolkit method response:
    - [`h.response()`](#h.response()) - wraps a plain response in a [response object](#response-object).
    - [`h.redirect()`](#h.redirect()) - wraps a plain response with a redirection directive.
    - [`h.authenticated()`](#h.authenticated()) - indicate request authenticated successfully
      (auth scheme only).
    - [`h.unauthenticated()`](#h.unauthenticated()) - indicate request failed to authenticate
      (auth scheme only).
- a promise object that resolve to any of the above values

Any error thrown by a lifecycle method will be used as the [response object](#response-object). While errors and valid
values can be returned, it is recommended to throw errors. Throwing non-error values will generate
a Bad Implementation (500) error response.

```js
const handler = function (request, h) {

    if (request.query.forbidden) {
        throw Boom.badRequest();
    }

    return 'success';
};
```

If the route has a [`bind`](#route.options.bind) option or [`server.bind()`](#server.bind()) was
called, the lifecycle method will be bound to the provided context via `this` as well as accessible
via [`h.context`](#h.context).

#### Lifecycle workflow

The flow between each lifecycle step depends on the value returned by each lifecycle method as
follows:

- an error:
    - the lifecycle skips to the _**Response validation**_ step.
    - if returned by the _**onRequest**_ step it skips to the _**onPreResponse**_ step.
    - if returned by the _**Response validation**_ step it skips to the _**onPreResponse**_ step.
    - if returned by the _**onPreResponse**_ step it skips to the _**Response transmission**_ step.

- an abort signal ([`h.abandon`](#h.abandon) or [`h.close`](#h.close)):
    - skips to the _**Finalize request**_ step.

- a [`h.continue`](#h.continue) signal:
    - continues processing the request lifecycle without changing the request response.
    - cannot be used by the [`authenticate()`](#authentication-scheme) scheme method.

- a [takeover response](#takeover-response):
    - overrides the request response with the provided value and skips to the
      _**Response validation**_ step.
    - if returned by the _**Response validation**_ step it skips to the _**onPreResponse**_ step.
    - if returned by the _**onPreResponse**_ step it skips to the _**Response transmission**_ step.

- any other response:
    - overrides the request response with the provided value and continues processing the request
      lifecycle.
    - cannot be returned from any step prior to the _**Pre-handler methods**_ step.

The [`authenticate()`](#authentication-scheme) method has access to two additional return values:
    - [`h.authenticated()`](#h.authenticated()) - indicate request authenticated successfully.
    - [`h.unauthenticated()`](#h.unauthenticated()) - indicate request failed to authenticate.

Note that these rules apply somewhat differently when used in a [pre-handler method](#route.options.pre).

#### Takeover response

A takeover response is a [`response object`](#response-object) on which [`response.takeover()`](#response.takever())
was called to signal that the [lifecycle method](#lifecycle-methods) return value should be set as
the response and skip to immediately validate and trasmit the value, bypassing other lifecycle
steps.

#### <a name="lifecycle-failAction" /> `failAction` configuration

Various configuration options allows defining how errors are handled. For example, when invalid
payload is received or malformed cookie, instead of returning an error, the framework can be
configured to perform another action. When supported the `failAction` option supports the following
values:

- `'error'` - return the error object as the response.
- `'log'` - report the error but continue processing the request.
- `'ignore'` - take no action and continue processing the request.

- a [lifecycle method](#lifecycle-methods) with the signature `async function(request, h, err)`
  where:
    - `request` - the [request object](#request).
    - `h` - the [response toolkit](#response-toolkit).
    - `err` - the error object.

#### Errors

**hapi** uses the [**boom**](https://hapi.dev/family/boom/api) error library for all its internal
error generation. **boom** provides an expressive interface to return HTTP errors. Any error
thrown by a [lifecycle method](#lifecycle-methods) is converted into a **boom** object and defaults to status
code `500` if the error is not already a **boom** object.

When the error is sent back to the client, the response contains a JSON object with the
`statusCode`, `error`, and `message` keys.

```js
const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');

const server = Hapi.server();

server.route({
    method: 'GET',
    path: '/badRequest',
    handler: function (request, h) {

        throw Boom.badRequest('Unsupported parameter');     // 400
    }
});

server.route({
    method: 'GET',
    path: '/internal',
    handler: function (request, h) {

        throw new Error('unexpect error');                  // 500
    }
});
```

##### Error transformation

Errors can be customized by changing their `output` content. The **boom** error object includes the
following properties:

- `isBoom` - if `true`, indicates this is a `Boom` object instance.

- `message` - the error message.

- `output` - the formatted response. Can be directly manipulated after object construction to
  return a custom error response. Allowed root keys:

    - `statusCode` - the HTTP status code (typically 4xx or 5xx).

    - `headers` - an object containing any HTTP headers where each key is a header name and value
      is the header content.

    - `payload` - the formatted object used as the response payload. Can be directly
      manipulated but any changes will be lost
      if `reformat()` is called. Any content allowed and by default includes the following content:

        - `statusCode` - the HTTP status code, derived from `error.output.statusCode`.

        - `error` - the HTTP status message (e.g. 'Bad Request', 'Internal Server Error') derived
          from `statusCode`.

        - `message` - the error message derived from `error.message`.

- inherited `Error` properties.

It also supports the following method:

- `reformat()` - rebuilds `error.output` using the other object properties.

```js
const Boom = require('@hapi/boom');

const handler = function (request, h) {

    const error = Boom.badRequest('Cannot feed after midnight');
    error.output.statusCode = 499;    // Assign a custom error code
    error.reformat();
    error.output.payload.custom = 'abc_123'; // Add custom key
    throw error;
});
```

When a different error representation is desired, such as an HTML page or a different payload
format, the `'onPreResponse'` extension point may be used to identify errors and replace them with
a different [response object](#response-object), as in this example using [Vision's](https://hapi.dev/family/vision/api)
`.view()` [response toolkit](#response-toolkit) property.

```js
const Hapi = require('@hapi/hapi');
const Vision = require('@hapi/vision');

const server = Hapi.server({ port: 80 });
server.register(Vision, (err) => {
    server.views({
        engines: {
            html: require('handlebars')
        }
    });
});

const preResponse = function (request, h) {

    const response = request.response;
    if (!response.isBoom) {
        return h.continue;
    }

    // Replace error with friendly HTML

      const error = response;
      const ctx = {
          message: (error.output.statusCode === 404 ? 'page not found' : 'something went wrong')
      };

      return h.view('error', ctx).code(error.output.statusCode);
};

server.ext('onPreResponse', preResponse);
```

### Response Toolkit

Access: read only.

The response toolkit is a collection of properties and utilities passed to every
[lifecycle method](#lifecycle-methods). It is somewhat hard to define as it provides both
utilities for manipulating responses as well as other information. Since the toolkit is passed
as a function argument, developers can name it whatever they want. For the purpose of this document
the `h` notation is used. It is named in the spirit of the RethinkDB `r` method, with `h` for
**h**api.

#### Toolkit properties

##### <a name="h.abandon" /> `h.abandon`

Access: read only.

A response symbol. When returned by a lifecycle method, the request lifecycle skips to the
finalizing step without further interaction with the node response stream. It is the developer's
responsibility to write and end the response directly via [`request.raw.res`](#request.raw).

##### <a name="h.close" /> `h.close`

Access: read only.

A response symbol. When returned by a lifecycle method, the request lifecycle skips to the
finalizing step after calling `request.raw.res.end())` to close the the node response stream.

##### <a name="h.context" /> `h.context`

Access: read / write (will impact the shared context if the object is modified).

A response symbol. Provides access to the route or server context set via the route
[`bind`](#route.options.bind) option or [`server.bind()`](#server.bind()).

##### <a name="h.continue" /> `h.continue`

Access: read only.

A response symbol. When returned by a lifecycle method, the request lifecycle continues without
changing the response.

##### <a name="h.realm" /> `h.realm`

Access: read only.

The [server realm](#server.realm) associated with the matching route. Defaults to the root server
realm in the _**onRequest**_ step.

##### <a name="h.request" /> `h.request`

Access: read only and public request interface.

The [request] object. This is a duplication of the `request` lifecycle method argument used by
[toolkit decorations](#server.decorate()) to access the current request.

#### <a name="h.authenticated()" /> `h.authenticated(data)`

Used by the [authentication] method to pass back valid credentials where:

- `data` - an object with:

    - `credentials` - (required) object representing the authenticated entity.
    - `artifacts` - (optional) authentication artifacts object specific to the authentication
      scheme.

Return value: an internal authentication object.

#### <a name="h.entity()" /> `h.entity(options)`

Sets the response 'ETag' and 'Last-Modified' headers and checks for any conditional request headers
to decide if the response is going to qualify for an HTTP 304 (Not Modified). If the entity values
match the request conditions, `h.entity()` returns a [response object](#response-object) for the lifecycle method to
return as its value which will set a 304 response. Otherwise, it sets the provided entity headers
and returns `undefined`. The method arguments are:

- `options` - a required configuration object with:
    - `etag` - the ETag string. Required if `modified` is not present. Defaults to no header.
    - `modified` - the Last-Modified header value. Required if `etag` is not present. Defaults to
      no header.
    - `vary` - same as the [`response.etag()`](#response.etag()) option. Defaults to `true`.

Return value:
    - a [response object](#response-object) if the response is unmodified.
    - `undefined` if the response has changed.

If `undefined` is returned, the developer must return a valid lifecycle method value. If a response
is returned, it should be used as the return value (but may be customize using the response
methods).

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.route({
    method: 'GET',
    path: '/',
    options: {
        cache: { expiresIn: 5000 },
        handler: function (request, h) {

            const response = h.entity({ etag: 'abc' });
            if (response) {
                response.header('X', 'y');
                return response;
            }

            return 'ok';
        }
    }
});
```

#### <a name="h.redirect()" /> `h.redirect(uri)`

Redirects the client to the specified uri. Same as calling `h.response().redirect(uri)`.

Returns a [response object](#response-object).

```js
const handler = function (request, h) {

    return h.redirect('http://example.com');
};
```

#### <a name="h.response()" /> `h.response([value])`

Wraps the provided value and returns a [`response`](#response-object) object which allows
customizing the response (e.g. setting the HTTP status code, custom headers, etc.), where:

- `value` - (optional) return value. Defaults to `null`.

Returns a [response object](#response-object).

```js
// Detailed notation

const handler = function (request, h) {

    const response = h.response('success');
    response.type('text/plain');
    response.header('X-Custom', 'some-value');
    return response;
};

// Chained notation

const handler = function (request, h) {

    return h.response('success')
        .type('text/plain')
        .header('X-Custom', 'some-value');
};
```

#### <a name="h.state()" /> `h.state(name, value, [options])`

Sets a response cookie using the same arguments as [`response.state()`](#response.state()).

Return value: none.

```js
const ext = function (request, h) {

    h.state('cookie-name', 'value');
    return h.continue;
};
```

#### <a name="h.unauthenticated()" /> `h.unauthenticated(error, [data])`

Used by the [authentication] method to indicate authentication failed and pass back the credentials
received where:
- `error` - (required) the authentication error.
- `data` - (optional) an object with:
    - `credentials` - (required) object representing the authenticated entity.
    - `artifacts` - (optional) authentication artifacts object specific to the authentication
      scheme.

The method is used to pass both the authentication error and the credentials. For example, if a
request included expired credentials, it allows the method to pass back the user information
(combined with a `'try'` authentication [`mode`](#route.options.auth.mode)) for error customization.

There is no difference between throwing the error or passing it with the `h.unauthenticated()`
method if no credentials are passed, but it might still be helpful for code clarity.

#### <a name="h.unstate()" /> `h.unstate(name, [options])`

Clears a response cookie using the same arguments as [`response.unstate()`](#response.unstate()).

```js
const ext = function (request, h) {

    h.unstate('cookie-name');
    return h.continue;
};
```

### Response object

The response object contains the request response value along with various HTTP headers and flags.
When a [lifecycle method](#lifecycle-methods) returns a value, the value is wrapped in a response
object along with some default flags (e.g. `200` status code). In order to customize a response
before it is returned, the [`h.response()`](#h.response()) method is provided.

#### Response properties

##### <a name="response.app" /> `response.app`

Access: read / write.

Default value: `{}`.

Application-specific state. Provides a safe place to store application data without potential
conflicts with the framework. Should not be used by [plugins](#plugins) which should use
[`plugins[name]`](#response.plugins).

##### <a name="response.contentType" /> `response.contentType`

Access: read.

Default value: none.

Provides a preview of the response HTTP Content-Type header based on the implicit response type, any explicit Content-Type header set, and any content character-set defined. The returned value is only a preview as the content type can change later both internally and by user code (it represents current response state). The value is `null` if no implicit type can be determined.

##### <a name="response.events" /> `response.events`

Access: read only and the public **podium** interface.

The `response.events` object supports the following events:

- `'peek'` - emitted for each chunk of data written back to the client connection. The event method
  signature is `function(chunk, encoding)`.

- `'finish'` - emitted when the response finished writing but before the client response connection
  is ended. The event method signature is `function ()`.

```js
const Crypto = require('crypto');
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const preResponse = function (request, h) {

    const response = request.response;
    if (response.isBoom) {
        return null;
    }

    const hash = Crypto.createHash('sha1');
    response.events.on('peek', (chunk) => {

        hash.update(chunk);
    });

    response.events.once('finish', () => {

        console.log(hash.digest('hex'));
    });

    return h.continue;
};

server.ext('onPreResponse', preResponse);
```

##### <a name="response.headers" /> `response.headers`

Access: read only.

Default value: `{}`.

An object containing the response headers where each key is a header field name and the value is
the string header value or array of string.

Note that this is an incomplete list of headers to be included with the response. Additional
headers will be added once the response is prepared for transmission.

##### <a name="response.plugins" /> `response.plugins`

Access: read / write.

Default value: `{}`.

Plugin-specific state. Provides a place to store and pass request-level plugin data. `plugins` is
an object where each key is a plugin name and the value is the state.

##### <a name="response.settings" /> `response.settings`

Access: read only.

Object containing the response handling flags.

###### <a name="response.settings.passThrough" /> `response.settings.passThrough`

Access: read only.

Defaults value: `true`.

If `true` and [`source`](#response.source) is a `Stream`, copies the `statusCode` and `headers`
properties of the stream object to the outbound response.

###### <a name="response.settings.stringify" /> `response.settings.stringify`

Access: read only.

Default value: `null` (use route defaults).

Override the route [`json`](#route.options.json) options used when [`source`](#response.source)
value requires stringification.

###### <a name="response.settings.ttl" /> `response.settings.ttl`

Access: read only.

Default value: `null` (use route defaults).

If set, overrides the route [`cache`](#route.options.cache) with an expiration value in
milliseconds.

###### <a name="response.settings.varyEtag" /> `response.settings.varyEtag`

Default value: `false`.

If `true`, a suffix will be automatically added to the 'ETag' header at transmission time
(separated by a `'-'` character) when the HTTP 'Vary' header is present.

##### <a name="response.source" /> `response.source`

Access: read only.

The raw value returned by the [lifecycle method](#lifecycle-methods).

##### <a name="response.statusCode" /> `response.statusCode`

Access: read only.

Default value: `200`.

The HTTP response status code.

##### <a name="response.variety" /> `response.variety`

Access: read only.

A string indicating the type of [`source`](#response.source) with available values:

- `'plain'` - a plain response such as string, number, `null`, or simple object.
- `'buffer'` - a `Buffer`.
- `'stream'` - a `Stream`.

#### <a name="response.bytes()" /> `response.bytes(length)`

Sets the HTTP 'Content-Length' header (to avoid chunked transfer encoding) where:

- `length` - the header value. Must match the actual payload size.

Return value: the current response object.

#### <a name="response.charset()" /> `response.charset(charset)`

Sets the 'Content-Type' HTTP header 'charset' property where:

- `charset` - the charset property value.

Return value: the current response object.

#### <a name="response.code()" /> `response.code(statusCode)`

Sets the HTTP status code where:

- `statusCode` - the HTTP status code (e.g. 200).

Return value: the current response object.

#### <a name="response.message()" /> `response.message(httpMessage)`

Sets the HTTP status message where:

- `httpMessage` - the HTTP status message (e.g. 'Ok' for status code 200).

Return value: the current response object.

#### <a name="response.compressed()" /> `response.compressed(encoding)`

Sets the HTTP 'content-encoding' header where:

- `encoding` - the header value string.

Return value: the current response object.

Note that setting content encoding via this method does not set a 'vary' HTTP header with 'accept-encoding' value. To vary the response, use the `response.header()` method instead.

#### <a name="response.created()" /> `response.created(uri)`

Sets the HTTP status code to Created (201) and the HTTP 'Location' header where:

- `uri` - an absolute or relative URI used as the 'Location' header value.

Return value: the current response object.

#### <a name="response.encoding()" /> `response.encoding(encoding)`

Sets the string encoding scheme used to serial data into the HTTP payload where:
- `encoding` - the encoding property value (see [node Buffer encoding](https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings)).

Return value: the current response object.

#### <a name="response.etag()" /> `response.etag(tag, options)`

Sets the representation [entity tag](https://tools.ietf.org/html/rfc7232#section-2.3) where:

- `tag` - the entity tag string without the double-quote.

- `options` - (optional) settings where:

    - `weak` - if `true`, the tag will be prefixed with the `'W/'` weak signifier. Weak tags will
      fail to match identical tags for the purpose of determining 304 response status. Defaults to
      `false`.

    - `vary` - if `true` and content encoding is set or applied to the response (e.g 'gzip' or
      'deflate'), the encoding name will be automatically added to the tag at transmission time
      (separated by a `'-'` character). Ignored when `weak` is `true`. Defaults to `true`.

Return value: the current response object.

#### <a name="response.header()" /> `response.header(name, value, options)`

Sets an HTTP header where:

- `name` - the header name.

- `value` - the header value.

- `options` - (optional) object where:

    - `append` - if `true`, the value is appended to any existing header value using `separator`.
      Defaults to `false`.

    - `separator` - string used as separator when appending to an existing value. Defaults to `','`.

    - `override` - if `false`, the header value is not set if an existing value present. Defaults
      to `true`.

    - `duplicate` - if `false`, the header value is not modified if the provided value is already
      included. Does not apply when `append` is `false` or if the `name` is `'set-cookie'`.
      Defaults to `true`.

Return value: the current response object.

#### <a name="response.location()" /> `response.location(uri)`

Sets the HTTP 'Location' header where:

- `uri` - an absolute or relative URI used as the 'Location' header value.

Return value: the current response object.

#### <a name="response.redirect()" /> `response.redirect(uri)`

Sets an HTTP redirection response (302) and decorates the response with additional methods, where:

- `uri` - an absolute or relative URI used to redirect the client to another resource.

Return value: the current response object.

Decorates the response object with the [`response.temporary()`](#response.temporary()),
[`response.permanent()`](#response.permanent()), and [`response.rewritable()`](#response.rewritable())
methods to easily change the default redirection code (302).

|                |  Permanent | Temporary |
| -------------- | ---------- | --------- |
| Rewritable     | 301        | 302       |
| Non-rewritable | 308        | 307       |

#### <a name="response.replacer()" /> `response.replacer(method)`

Sets the `JSON.stringify()` `replacer` argument where:

- `method` - the replacer function or array. Defaults to none.

Return value: the current response object.

#### <a name="response.spaces()" /> `response.spaces(count)`

Sets the `JSON.stringify()` `space` argument where:

- `count` - the number of spaces to indent nested object keys. Defaults to no indentation.

Return value: the current response object.

#### <a name="response.state()" /> `response.state(name, value, [options])`

Sets an HTTP cookie where:

- `name` - the cookie name.

- `value` - the cookie value. If no `options.encoding` is defined, must be a string. See
  [`server.state()`](#server.state()) for supported `encoding` values.

- `options` - (optional) configuration. If the state was previously registered with the server
  using [`server.state()`](#server.state()), the specified keys in `options` are merged with the
  default server definition.

Return value: the current response object.

#### <a name="response.suffix()" /> `response.suffix(suffix)`

Sets a string suffix when the response is process via `JSON.stringify()` where:

- `suffix` - the string suffix.

Return value: the current response object.

#### <a name="response.ttl()" /> `response.ttl(msec)`

Overrides the default route cache expiration rule for this response instance where:

- `msec` - the time-to-live value in milliseconds.

Return value: the current response object.

#### <a name="response.type()" /> `response.type(mimeType)`

Sets the HTTP 'Content-Type' header where:

- `mimeType` - is the mime type.

Return value: the current response object.

Should only be used to override the built-in default for each response type.

#### <a name="response.unstate()" /> `response.unstate(name, [options])`

Clears the HTTP cookie by setting an expired value where:
- `name` - the cookie name.
- `options` - (optional) configuration for expiring cookie. If the state was previously registered
  with the server using [`server.state()`](#serverstatename-options), the specified `options` are
  merged with the server definition.

Return value: the current response object.

#### <a name="response.vary()" /> `response.vary(header)`

Adds the provided header to the list of inputs affected the response generation via the HTTP 'Vary'
header where:

- `header` - the HTTP request header name.

Return value: the current response object.

#### <a name="response.takeover()" /> `response.takeover()`

Marks the response object as a [takeover response](#takeover-response).

Return value: the current response object.

#### <a name="response.temporary()" /> `response.temporary(isTemporary)`

Sets the status code to `302` or `307` (based on the [`response.rewritable()`](#response.rewriteable())
setting) where:

- `isTemporary` - if `false`, sets status to permanent. Defaults to `true`.

Return value: the current response object.

Only available after calling the [`response.redirect()`](#response.redirect()) method.

#### <a name="response.permanent()" /> `response.permanent(isPermanent)`

Sets the status code to `301` or `308` (based on the [`response.rewritable()`](#response.rewritable())
setting) where:

- `isPermanent` - if `false`, sets status to temporary. Defaults to `true`.

Return value: the current response object.

Only available after calling the [`response.redirect()`](#response.redirect()) method.

#### <a name="response.rewritable()" /> `response.rewritable(isRewritable)`

Sets the status code to `301`/`302` for rewritable (allows changing the request method from 'POST'
to 'GET') or `307`/`308` for non-rewritable (does not allow changing the request method from 'POST'
to 'GET'). Exact code based on the [`response.temporary()`](#response.temporary()) or
[`response.permanent()`](#response.permanent()) setting. Arguments:

- `isRewritable` - if `false`, sets to non-rewritable. Defaults to `true`.

Return value: the current response object.

Only available after calling the [`response.redirect()`](#response.redirect()) method.

## Request

The request object is created internally for each incoming request. It is not the same object
received from the node HTTP server callback (which is available via [`request.raw.req`](#request.raw)).
The request properties change throughout the [request lifecycle](#request-lifecycle).

### Request properties

#### <a name="request.app" /> `request.app`

Access: read / write.

Application-specific state. Provides a safe place to store application data without potential
conflicts with the framework. Should not be used by [plugins](#plugins) which should use
`plugins[name]`.

#### <a name="request.auth" /> `request.auth`

Access: read only.

Authentication information:

- `artifacts` - an artifact object received from the authentication strategy and used in
  authentication-related actions.

- `credentials` - the `credential` object received during the authentication process. The
  presence of an object does not mean successful authentication.

- `error` - the authentication error if failed and mode set to `'try'`.

- `isAuthenticated` - `true` if the request has been successfully authenticated, otherwise `false`.

- `isAuthorized` - `true` is the request has been successfully authorized against the route
  authentication [`access`](#route.options.auth.access) configuration. If the route has not
  access rules defined or if the request failed authorization, set to `false`.

- `isInjected` - `true` if the request has been authenticated via the
  [`server.inject()`](#server.inject()) `auth` option, otherwise `undefined`.

- `mode` - the route authentication mode.

- `strategy` - the name of the strategy used.

#### <a name="request.events" /> `request.events`

Access: read only and the public **podium** interface.

The `request.events` supports the following events:

- `'peek'` - emitted for each chunk of payload data read from the client connection. The event
  method signature is `function(chunk, encoding)`.

- `'finish'` - emitted when the request payload finished reading. The event method signature is
  `function ()`.

- `'disconnect'` - emitted when a request errors or aborts unexpectedly.

```js
const Crypto = require('crypto');
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const onRequest = function (request, h) {

    const hash = Crypto.createHash('sha1');
    request.events.on('peek', (chunk) => {

        hash.update(chunk);
    });

    request.events.once('finish', () => {

        console.log(hash.digest('hex'));
    });

    request.events.once('disconnect', () => {

        console.error('request aborted');
    });

    return h.continue;
};

server.ext('onRequest', onRequest);
```

#### <a name="request.headers" /> `request.headers`

Access: read only.

The raw request headers (references `request.raw.req.headers`).

#### <a name="request.info" /> `request.info`

Access: read only.

Request information:

- `acceptEncoding` - the request preferred encoding.

- `completed` - request processing completion timestamp (`0` is still processing).

- `cors` - request CORS information (available only after the `'onRequest'` extension point as CORS
  is configured per-route and no routing decisions are made at that point in the request
  lifecycle), where:
    - `isOriginMatch` - `true` if the request 'Origin' header matches the configured CORS
      restrictions. Set to `false` if no 'Origin' header is found or if it does not match.

- `host` - content of the HTTP 'Host' header (e.g. 'example.com:8080').

- `hostname` - the hostname part of the 'Host' header (e.g. 'example.com').

- `id` - a unique request identifier (using the format '{now}:{connection.info.id}:{5 digits counter}').

- `received` - request reception timestamp.

- `referrer` - content of the HTTP 'Referrer' (or 'Referer') header.

- `remoteAddress` - remote client IP address.

- `remotePort` - remote client port.

- `responded` - request response timestamp (`0` is not responded yet or response failed when `completed` is set).

Note that the `request.info` object is not meant to be modified.

#### <a name="request.isInjected" /> `request.isInjected`

Access: read only.

`true` if the request was created via [`server.inject()`](#server.inject()), and `false` otherwise.

#### <a name="request.logs" /> `request.logs`

Access: read only.

An array containing the logged request events.

Note that this array will be empty if route [`log.collect`](#route.options.log) is set to `false`.

#### <a name="request.method" /> `request.method`

Access: read only.

The request method in lower case (e.g. `'get'`, `'post'`).

#### <a name="request.mime" /> `request.mime`

Access: read only.

The parsed content-type header. Only available when payload parsing enabled and no  payload error occurred.

#### <a name="request.orig" /> `request.orig`

Access: read only.

An object containing the values of `params`, `query`, `payload` and `state` before any validation modifications made. Only set when input validation is performed.

#### <a name="request.params" /> `request.params`

Access: read only.

An object where each key is a path parameter name with matching value as described in [Path parameters](#path-parameters).

#### <a name="request.paramsArray" /> `request.paramsArray`

Access: read only.

An array containing all the path `params` values in the order they appeared in the path.

#### <a name="request.path" /> `request.path`

Access: read only.

The request URI's [pathname](https://nodejs.org/api/url.html#url_urlobject_pathname) component.

#### <a name="request.payload" /> `request.payload`

Access: read only / write in `'onRequest'` extension method.

The request payload based on the route `payload.output` and `payload.parse` settings. Set to `undefined` in `'onRequest'` extension methods and can be overridden to any non-`undefined` value to bypass payload processing.

#### <a name="request.plugins" /> `request.plugins`

Access: read / write.

Plugin-specific state. Provides a place to store and pass request-level plugin data. The `plugins` is an object where each key is a plugin name and the value is the state.

#### <a name="request.pre" /> `request.pre`

Access: read only.

An object where each key is the name assigned by a [route pre-handler methods](#route.options.pre) function. The values are the raw values provided to the continuation function as argument. For the wrapped response object, use `responses`.

#### <a name="request.response" /> `request.response`

Access: read / write (see limitations below).

The response object when set. The object can be modified but must not be assigned another object. To replace the response with another from within an [extension point](#server.ext()), return a new response value. Contains an error when a request terminates prematurely when the client disconnects.

#### <a name="request.preResponses" /> `request.preResponses`

Access: read only.

Same as `pre` but represented as the response object created by the pre method.

#### <a name="request.query" /> `request.query`

Access: read only.

An object where each key is a query parameter name and each matching value is the parameter value or an array of values if a parameter repeats. Can be modified indirectly via [request.setUrl](#request.setUrl()).

#### <a name="request.raw" /> `request.raw`

Access: read only.

An object containing the Node HTTP server objects. **Direct interaction with these raw objects is not recommended.**
- `req` - the node request object.
- `res` - the node response object.

#### <a name="request.route" /> `request.route`

Access: read only.

The request route information object, where:
- `method` - the route HTTP method.
- `path` - the route path.
- `vhost` - the route vhost option if configured.
- `realm` - the [active realm](#server.realm) associated with the route.
- `settings` - the [route options](#route-options) object with all defaults applied.
- `fingerprint` - the route internal normalized string representing the normalized path.

#### <a name="request.server" /> `request.server`

Access: read only and the public server interface.

The server object.

#### <a name="request.state" /> `request.state`

Access: read only.

An object containing parsed HTTP state information (cookies) where each key is the cookie name and value is the matching cookie content after processing using any registered cookie definition.

#### <a name="request.url" /> `request.url`

Access: read only.

The parsed request URI.

### <a name="request.generateResponse()" /> `request.generateResponse(source, [options])`

Returns a [`response`](#response-object) which you can pass into the [reply interface](#response-toolkit) where:
- `source` - the value to set as the source of the [reply interface](#response-toolkit), optional.
- `options` - optional object with the following optional properties:
    - `variety` - a sting name of the response type (e.g. `'file'`).
    - `prepare` - a function with the signature `async function(response)` used to prepare the response after it is returned by a [lifecycle method](#lifecycle-methods) such as setting a file descriptor, where:
        - `response` - the response object being prepared.
        - must return the prepared response object (new object or `response`).
        - may throw an error which is used as the prepared response.
    - `marshal` - a function with the signature `async function(response)` used to prepare the response for transmission to the client before it is sent, where:
        - `response` - the response object being marshaled.
        - must return the prepared value (not as response object) which can be any value accepted by the [`h.response()`](#h.response()) `value` argument.
        - may throw an error which is used as the marshaled value.
    - `close` - a function with the signature `function(response)` used to close the resources opened by the response object (e.g. file handlers), where:
        - `response` - the response object being marshaled.
        - should not throw errors (which are logged but otherwise ignored).

### <a name="request.active()" /> `request.active()`

Returns `true` when the request is active and processing should continue and `false` when the request terminated early or completed its lifecycle. Useful when request processing is a resource-intensive operation and should be terminated early if the request is no longer active (e.g. client disconnected or aborted early).

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

server.route({
    method: 'POST',
    path: '/worker',
    handler: function (request, h) {

        // Do some work...

        // Check if request is still active
        if (!request.active()) {
            return h.close;
        }

        // Do some more work...

        return null;
    }
});
```

### <a name="request.log()" /> `request.log(tags, [data])`

Logs request-specific events. When called, the server emits a [`'request'` event](#server.events.request)
on the `'app'` channel which can be used by other listeners or [plugins](#plugins). The arguments
are:
- `tags` - a string or an array of strings (e.g. `['error', 'database', 'read']`) used to identify
  the event. Tags are used instead of log levels and provide a much more expressive mechanism for
  describing and filtering events.
- `data` - (optional) an message string or object with the application data being logged. If `data`
  is a function, the function signature is `function()` and it called once to generate (return
  value) the actual data emitted to the listeners.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80, routes: { log: { collect: true } } });

server.events.on({ name: 'request', channels: 'app' }, (request, event, tags) => {

    if (tags.error) {
        console.log(event);
    }
});

const handler = function (request, h) {

    request.log(['test', 'error'], 'Test event');
    return null;
};
```

Note that any logs generated by the server internally will be emitted using the
[`'request'` event](#server.events.request) on the `'internal'` channel.

```js
server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

    console.log(event);
});
```

### <a name="request.route.auth.access()" /> `request.route.auth.access(request)`

Validates a request against the route's authentication [`access`](#route.options.auth.access)
configuration, where:

- `request` - the [request object](#request).

Return value: `true` if the `request` would have passed the route's access requirements.

Note that the route's authentication mode and strategies are ignored. The only match is made
between the `request.auth.credentials` scope and entity information and the route
[`access`](#route.options.auth.access) configuration.

If the route uses dynamic scopes, the scopes are constructed against the [`request.query`](#request.query),
[`request.params`](#request.params), [`request.payload`](#request.payload), and
[`request.auth.credentials`](#request.auth) which may or may not match between the route and the
request's route. If this method is called using a request that has not been authenticated (yet or
not at all), it will return `false` if the route requires any authentication.

### <a name="request.setMethod()" /> `request.setMethod(method)`

Changes the request method before the router begins processing the request where:
- `method` - is the request HTTP method (e.g. `'GET'`).

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const onRequest = function (request, h) {

    // Change all requests to 'GET'
    request.setMethod('GET');
    return h.continue;
};

server.ext('onRequest', onRequest);
```

Can only be called from an `'onRequest'` extension method.

### <a name="request.setUrl()" /> `request.setUrl(url, [stripTrailingSlash]`

Changes the request URI before the router begins processing the request where:
- `url` - the new request URI. `url` can be a string or an instance of
  [`Url.URL`](https://nodejs.org/dist/latest-v10.x/docs/api/url.html#url_class_url) in which case
  `url.href` is used.
- `stripTrailingSlash` - if `true`, strip the trailing slash from the path. Defaults to `false`.

```js
const Hapi = require('@hapi/hapi');
const server = Hapi.server({ port: 80 });

const onRequest = function (request, h) {

    // Change all requests to '/test'
    request.setUrl('/test');
    return h.continue;
};

server.ext('onRequest', onRequest);
```

Can only be called from an `'onRequest'` extension method.

## Plugins

Plugins provide a way to organize application code by splitting the server logic into smaller
components. Each plugin can manipulate the server through the standard server interface, but with
the added ability to sandbox certain properties. For example, setting a file path in one plugin
doesn't affect the file path set in another plugin.

A plugin is an object with the following properties:

- `register` - (required) the registration function with the signature
  `async function(server, options)` where:

    - `server` - the server object with a plugin-specific [`server.realm`](#server.realm).
    - `options` - any options passed to the plugin during registration via [`server.register()`](#server.register()).

- `name` - (required) the plugin name string. The name is used as a unique key. Published plugins
  (e.g. published in the npm registry) should  use the same name as the name field in their
  'package.json' file. Names must be unique within each application.

- `version` - (optional) plugin version string. The version is only used informatively to enable
  other plugins to find out the versions loaded. The version should be the same as the one
  specified in the plugin's 'package.json' file.

- `multiple` - (optional) if `true`, allows the plugin to be registered multiple times with the same server.
  Defaults to `false`.

- `dependencies` - (optional) a string or an array of strings indicating a plugin dependency. Same
  as setting dependencies via [`server.dependency()`](#server.dependency()).

- `requirements` - (optional) object declaring the plugin supported [semver range](https://semver.org/) for:

  - `node` runtime [semver range](https://nodejs.org/en/about/releases/) string.
  - `hapi` framework [semver range](#server.version) string.

- `once` - (optional) if `true`, will only register the plugin once per server. If set, overrides
  the `once` option passed to [`server.register()`](#server.register()). Defaults to no override.

```js
const plugin = {
    name: 'test',
    version: '1.0.0',
    register: function (server, options) {

        server.route({
            method: 'GET',
            path: '/test',
            handler: function (request, h) {

                return 'ok';
            }
        });
    }
};
```

Alternatively, the `name` and `version` can be included via the `pkg` property containing the
'package.json' file for the module which already has the name and version included:

```js
const plugin = {
    pkg: require('./package.json'),
    register: function (server, options) {

        server.route({
            method: 'GET',
            path: '/test',
            handler: function (request, h) {

                return 'ok';
            }
        });
    }
};
```
