# 17.0.x API Reference

- [Server](#server)
    - [`new Server([options])`](#new-serveroptions)
    - [Server properties](#server-properties)
        - [`server.app`](#serverapp)
        - [`server.connections`](#serverconnections)
        - [`server.decorations`](#serverdecorations)
        - [`server.info`](#serverinfo)
        - [`server.load`](#serverload)
        - [`server.listener`](#serverlistener)
        - [`server.methods`](#servermethods)
        - [`server.mime`](#servermime)
        - [`server.plugins`](#serverplugins)
        - [`server.realm`](#serverrealm)
        - [`server.registrations`](#serverregistrations)
        - [`server.root`](#serverroot)
        - [`server.settings`](#serversettings)
        - [`server.version`](#serverversion)
    - [`server.auth.api`](#serverauthapi)
    - [`server.auth.default(options)`](#serverauthdefaultoptions)
    - [`server.auth.scheme(name, scheme)`](#serverauthschemename-scheme)
    - [`server.auth.strategy(name, scheme, [mode], [options])`](#serverauthstrategyname-scheme-mode-options)
    - [`server.auth.test(strategy, request, next)`](#serverauthteststrategy-request-next)
    - [`server.bind(context)`](#serverbindcontext)
    - [`server.cache(options)`](#servercacheoptions)
    - [`server.cache.provision(options, [callback])`](#servercacheprovisionoptions-callback)
    - [`server.connection([options])`](#serverconnectionoptions)
    - [`server.decoder(encoding, decoder)`](#serverencoderencoding-decoder)
    - [`server.decorate(type, property, method, [options])`](#serverdecoratetype-property-method-options)
    - [`server.dependency(dependencies, [after])`](#serverdependencydependencies-after)
    - [`server.emit(criteria, data, [callback])`](#serveremitcriteria-data-callback)
    - [`server.encoder(encoding, encoder)`](#serverencoderencoding-encoder)
    - [`server.event(events)`](#servereventevents)
    - [`server.expose(key, value)`](#serverexposekey-value)
    - [`server.expose(obj)`](#serverexposeobj)
    - [`server.ext(events)`](#serverextevents)
    - [`server.ext(event, method, [options])`](#serverextevent-method-options)
    - [`server.handler(name, method)`](#serverhandlername-method)
    - [`server.initialize([callback])`](#serverinitializecallback)
    - [`server.inject(options, [callback])`](#serverinjectoptions-callback)
    - [`server.log(tags, [data, [timestamp]])`](#serverlogtags-data-timestamp)
    - [`server.lookup(id)`](#serverlookupid)
    - [`server.match(method, path, [host])`](#servermatchmethod-path-host)
    - [`server.method(name, method, [options])`](#servermethodname-method-options)
    - [`server.method(methods)`](#servermethodmethods)
    - [`server.on(criteria, listener)`](#serveroncriteria-listener)
    - [`server.once(criteria, listener)`](#serveroncecriteria-listener)
    - [`server.path(relativeTo)`](#serverpathrelativeto)
    - [`server.register(plugins, [options], [callback])`](#serverregisterplugins-options-callback)
    - [`server.route(options)`](#serverrouteoptions)
    - [`server.select(labels)`](#serverselectlabels)
    - [`server.start([callback])`](#serverstartcallback)
    - [`server.state(name, [options])`](#serverstatename-options)
    - [`server.stop([options], [callback])`](#serverstopoptions-callback)
    - [`server.table([host])`](#servertablehost)
    - [Server events](#server-events)
        - [Internal events](#internal-events)
            - [Request logs](#request-logs)
            - [Server logs](#server-logs)
- [Plugins](#plugins)
- [Requests](#requests)
    - [Request lifecycle](#request-lifecycle)
    - [Route configuration](#route-configuration)
        - [Route options](#route-options)
        - [Route public interface](#route-public-interface)
    - [Path parameters](#path-parameters)
    - [Path matching order](#path-matching-order)
        - [Catch all route](#catch-all-route)
    - [Route handler](#route-handler)
    - [Route prerequisites](#route-prerequisites)
    - [Request object](#request-object)
        - [Request properties](#request-properties)
        - [`request.setUrl(url, [stripTrailingSlash])`](#requestseturlurl-stripTrailingSlash)
        - [`request.setMethod(method)`](#requestsetmethodmethod)
        - [`request.generateResponse(source, [options])`](#requestgenerateresponsesource-options)
        - [`request.log(tags, [data, [timestamp]])`](#requestlogtags-data-timestamp)
        - [`request.getLog([tags], [internal])`](#requestgetlogtags-internal)
        - [`request.tail([name])`](#requesttailname)
        - [Request events](#request-events)
- [Reply interface](#reply-interface)
    - [`reply([err], [result])`](#replyerr-result)
        - [Response object](#response-object)
            - [Response Object Redirect Methods](#response-object-redirect-methods)
            - [Response events](#response-events)
        - [Error response](#error-response)
            - [Error transformation](#error-transformation)
        - [Flow control](#flow-control)
    - [`reply.continue([result])`](#replycontinueresult)
    - [`reply.close([options])`](#replycloseoptions)
    - [`reply.redirect(uri)`](#replyredirecturi)
    - [`reply.response(result)`](#replyresponseresult)
    - [`reply.state(name, value, [options])`](#replystatenamevalueoptions)
    - [`reply.unstate(name, [options])`](#replyunstatenameoptions)

## Server

The `Server` object is the main application container. The server manages all incoming connections
along with all the facilities provided by the framework. A server can contain more than one
connection (e.g. listen to port `80` and `8080`).

### `new Server([options])`

Creates a new `Server` object where:
- `options` - optional configuration:
    - `app` - application-specific configuration which can later be accessed via
      `server.settings.app`. Note the difference between `server.settings.app` which is
      used to store static configuration values and [`server.app`](#serverapp) which is meant for
      storing run-time state. Defaults to `{}`.

    - <a name="server.config.cache"></a>`cache` - sets up server-side caching. Every server
      includes a default cache for storing application state. By default, a simple memory-based
      cache is created which has limited capacity and capabilities. **hapi** uses
      [**catbox**](https://github.com/hapijs/catbox) for its cache which includes support for
      common storage solutions (e.g. Redis, MongoDB, Memcached, Riak, among others). Caching is only utilized
      if methods and [plugins](#plugins) explicitly store their state in the cache. The server
      cache configuration only defines the storage container itself. `cache` can be assigned:
        - a prototype function (usually obtained by calling `require()` on a **catbox** strategy
          such as `require('catbox-redis')`). A new **catbox** [client](https://github.com/hapijs/catbox#client) will be created internally using this function.
        - a configuration object with the following optional keys (unless stated otherwise):
            - `engine` - a prototype function or **catbox** engine object.
            - `name` - an identifier used later when provisioning or configuring caching for
              [server methods](#servermethodname-method-options) or [plugins](#plugins). Each cache
              name must be unique. A single item may omit the `name` option which defines the
              default cache. If every cache includes a `name`, a default memory cache is provisioned
              as well.
            - `shared` - if `true`, allows multiple cache users to share the same segment (e.g.
              multiple methods using the same cache storage container). Default to `false`.
            - `partition` - optional string, defaults to `'hapi-cache'`.
            - other options passed to the **catbox** strategy used.  Other options are only passed
              to CatBox when `engine` above is a function and ignored if `engine` is a **catbox**
              engine object).
        - an array of the above object for configuring multiple cache instances, each with a unique
          name. When an array of objects is provided, multiple cache connections are established
          and each array item (except one) must include a `name`.

    - <a name="server.config.connections"></a>`connections` - sets the default connections
      configuration which can be overridden by each connection where:

        - `app` - application-specific connection configuration which can be accessed via
          `connection.settings.app`. Provides a safe place to store application configuration
          without potential conflicts with the framework internals. Should not be used to configure
          [plugins](#plugins) which should use `plugins[name]`. Note the difference between
          `connection.settings.app` which is used to store configuration values and
          `connection.app` which is meant for storing run-time state.

        - `compression` - if `false`, response content encoding is disabled. Defaults to `true`.

        - `load` - connection load limits configuration where:
            - `maxHeapUsedBytes` - maximum V8 heap size over which incoming requests are rejected
              with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).
            - `maxRssBytes` - maximum process RSS size over which incoming requests are rejected
              with an HTTP Server Timeout (503) response. Defaults to `0` (no limit).
            - `maxEventLoopDelay` - maximum event loop delay duration in milliseconds over which
              incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults
              to `0` (no limit).

        - `plugins` - plugin-specific configuration which can later be accessed via
          `connection.settings.plugins`. Provides a place to store and pass connection-specific
           plugin configuration. `plugins` is an object where each key is a plugin name and the
           value is the configuration. Note the difference between `connection.settings.plugins`
           which is used to store configuration values and `connection.plugins` which is meant for
           storing run-time state.

        - <a name="connection.config.router"></a>`router` - controls how incoming request URIs are
          matched against the routing table:
            - `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are
              considered different resources. Defaults to `true`.
            - `stripTrailingSlash` - removes trailing slashes on incoming paths. Defaults to
              `false`.

        - `routes` - a [route options](#route-options) object used to set the default configuration
          for every route.

        - `state` - sets the default configuration for every state (cookie) set explicitly via
          [`server.state()`](#serverstatename-options) or implicitly (without definition) using
          the [state configuration](#serverstatename-options) object.

    - `debug` - determines which logged events are sent to the console (this should only be used
      for development and does not affect which events are actually logged internally and
      recorded). Set to `false` to disable all console logging, or to an object with:
        - `log` - a string array of server log tags to be displayed via `console.error()` when
          the events are logged via [`server.log()`](#serverlogtags-data-timestamp) as well as
          internally generated [server logs](#server-logs). For example, to display all errors,
          set the option to `['error']`. To turn off all console debug messages set it to `false`.
          To display all server logs, set it to '*'.
          Defaults to uncaught errors thrown in external code (these errors are handled
          automatically and result in an Internal Server Error response) or runtime errors due to
          developer error.
        - `request` - a string array of request log tags to be displayed via `console.error()` when
          the events are logged via [`request.log()`](#requestlogtags-data-timestamp) as well as
          internally generated [request logs](#request-logs). For example, to display all errors,
          set the option to `['error']`. To turn off all console debug messages set it to `false`.
          To display all request logs, set it to '*'.
          Defaults to uncaught errors thrown in external code (these errors are handled
          automatically and result in an Internal Server Error response) or runtime errors due to
          developer error.

    - `load` - process load monitoring where:
        - `sampleInterval` - the frequency of sampling in milliseconds. Defaults to `0` (no
          sampling).

    - `mime` - options passed to the [**mimos**](https://github.com/hapijs/mimos) module when
      generating the mime database used by the server and accessed via
      [`server.mime`](#servermime).

    - `plugins` - plugin-specific configuration which can later be accessed via
      `server.settings.plugins`. `plugins` is an object where each key is a plugin name and the
      value is the configuration. Note the difference between `server.settings.plugins` which is
      used to store static configuration values and [`server.plugins`](#serverplugins) which is
      meant for storing run-time state. Defaults to `{}`.

    - `useDomains` - if `false`, will not use node domains to protect against exceptions thrown in
      handlers and other external code. Defaults to `true`.

Note that the `options` object is deeply cloned and cannot contain any values that are unsafe to
perform deep copy on.

```js
const Hapi = require('hapi');
const server = new Hapi.Server({
    cache: require('catbox-redis'),
    load: {
        sampleInterval: 1000
    }
});
```

### Server properties

#### `server.app`

Provides a safe place to store server-specific run-time application data without potential
conflicts with the framework internals. The data can be accessed whenever the server is
accessible. Initialized with an empty object.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.app.key = 'value';

const handler = function (request, reply) {

    return reply(request.server.app.key);
};
```

#### `server.connections`

An array containing the server's connections. When the server object is returned from
[`server.select()`](#serverselectlabels), the `connections` array only includes the connections
matching the selection criteria.

```js
const server = new Hapi.Server();
server.connection({ port: 80, labels: 'a' });
server.connection({ port: 8080, labels: 'b' });

// server.connections.length === 2

const a = server.select('a');

// a.connections.length === 1
```

Each connection object contains:
- `settings` - the connection configuration object passed to
  [`server.connection()`](#serverconnectionoptions) after applying the server defaults.
- `server` - the connection's `Server` object.
- `type` - set to `'tcp'` is the connection is listening on a TCP port, otherwise to `'socket'`(a
  UNIX domain socket or a Windows named pipe).
- `registrations` -
- `states` -
- `auth` -
- `plugins` -
- `app` -
- `listener` -
- `info` -
- `inject()` -
- `table()` -
- `lookup()` -
- `match()` -

### `server.decorations`

Provides access to the decorations already applied to various framework interfaces. The object must
not be modified directly, but only through [`server.decorate`](#serverdecoratetype-property-method-options).
Contains the following keys:
    - `'request'` - decorations on the [Request object](#request-object).
    - `'reply'` - decorations on the [reply interface](#reply-interface).
    - `'server'` - decorations on the [Server](#server) object.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const success = function () {

    return this.response({ status: 'ok' });
};

server.decorate('reply', 'success', success);
return server.decorations.reply;		// ['success']
```


#### `server.info`

When the server contains exactly one connection, `info` is an object containing information about
the sole connection where:
- `id` - a unique connection identifier (using the format '{hostname}:{pid}:{now base36}').
- `created` - the connection creation timestamp.
- `started` - the connection start timestamp (`0` when stopped).
- `port` - the connection port based on the following rules:
    - the configured port value before the server has been started.
    - the actual port assigned when no port is configured or set to `0` after the server has been
      started.
- `host` - the host name the connection was configured to. Defaults to the operating system
  hostname when available, otherwise `'localhost'`.
- `address` - the active IP address the connection was bound to after starting. Set to `undefined`
  until the server has been started or when using a non TCP port (e.g. UNIX domain socket).
- `protocol` - the protocol used:
    - `'http'` - HTTP.
    - `'https'` - HTTPS.
    - `'socket'` - UNIX domain socket or Windows named pipe.
- `uri` - a string representing the connection (e.g. 'http://example.com:8080' or
  'socket:/unix/domain/socket/path'). Contains the `uri` setting if provided, otherwise constructed
  from the available settings. If no `port` is available or set to `0`, the `uri` will not include
  a port component.

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.info`.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

// server.info.port === 80

server.connection({ port: 8080 });

// server.info === null
// server.connections[1].info.port === 8080
```

#### `server.load`

An object containing the process load metrics (when `load.sampleInterval` is enabled):
- `eventLoopDelay` - event loop delay milliseconds.
- `heapUsed` - V8 heap usage.
- `rss` - RSS memory usage.


```js
const Hapi = require('hapi');
const server = new Hapi.Server({ load: { sampleInterval: 1000 } });

console.log(server.load.rss);
```

#### `server.listener`

When the server contains exactly one connection, `listener` is the node HTTP server object of the
sole connection.

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.listener`.

```js
const Hapi = require('hapi');
const SocketIO = require('socket.io');

const server = new Hapi.Server();
server.connection({ port: 80 });

const io = SocketIO.listen(server.listener);
io.sockets.on('connection', (socket) => {

    socket.emit({ msg: 'welcome' });
});
```

#### `server.methods`

An object providing access to the [server methods](#servermethodname-method-options) where each
server method name is an object property.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();

const add = function (a, b, next) {

    return next(null, a + b);
};

server.method('add', add);

server.methods.add(1, 2, (err, result) => {

    // result === 3
});
```

#### `server.mime`

Provides access to the server MIME database used for setting content-type information. The object
must not be modified directly but only through the `mime` server setting.

```js
const Hapi = require('hapi');

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

const server = new Hapi.Server(options);
// server.mime.path('code.js').type === 'application/javascript'
// server.mime.path('file.npm').type === 'node/module'
```

#### `server.plugins`

An object containing the values exposed by each plugin registered where each key is a plugin name
and the values are the exposed properties by each plugin using
[`server.expose()`](#serverexposekey-value). Plugins may set the value of the
`server.plugins[name]` object directly or via the `server.expose()` method.

```js
exports.register = function (server, options, next) {

    server.expose('key', 'value');
    // server.plugins.example.key === 'value'
    return next();
};

exports.register.attributes = {
    name: 'example'
};
```

#### `server.realm`

The realm object contains server-wide or plugin-specific state that can be shared across various
methods. For example, when calling [`server.bind()`](#serverbindcontext), the active realm
`settings.bind` property is set which is then used by routes and extensions added at the same level
(server root or plugin). Realms are a limited version of a sandbox where plugins can maintain state
used by the framework when adding routes, extensions, and other properties.

- `modifiers` - when the server object is provided as an argument to the plugin `register()`
  method, `modifiers` provides the registration preferences passed the
  [`server.register()`](#serverregisterplugins-options-callback) method and includes:
    - `route` - routes preferences:
        - `prefix` - the route path prefix used by any calls to [`server.route()`](#serverrouteoptions)
          from the server. Note that if a prefix is used and the route path is set to `'/'`, the
          resulting path will not include the trailing slash.
        - `vhost` - the route virtual host settings used by any calls to
          [`server.route()`](#serverrouteoptions) from the server.
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
exports.register = function (server, options, next) {

    console.log(server.realm.modifiers.route.prefix);
    return next();
};
```

#### `server.registrations`

When the server contains exactly one connection, `registrations` is an object where each key is a
registered plugin name and value contains:
- `version` - the plugin version.
- `name` - the plugin name.
- `options` - optional options passed to the plugin during registration.
- `attributes` - plugin registration attributes.

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.registrations`.

#### `server.root`

The root server object containing all the connections and the root server methods (e.g. `start()`,
`stop()`, `connection()`).

#### `server.settings`

The server configuration object after defaults applied.

```js
const Hapi = require('hapi');
const server = new Hapi.Server({
    app: {
        key: 'value'
    }
});

// server.settings.app === { key: 'value' }
```

#### `server.version`

The **hapi** module version number.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
// server.version === '8.0.0'
```

### `server.auth.api`

An object where each key is a strategy name and the value is the exposed strategy API. Available
only when the authentication scheme exposes an API by returning an `api` key in the object returned
from its implementation function.

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.auth.api` object.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

const scheme = function (server, options) {

    return {
        api: {
            settings: {
                x: 5
            }
        },
        authenticate: function (request, reply) {

            const req = request.raw.req;
            const authorization = req.headers.authorization;
            if (!authorization) {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            return reply.continue({ credentials: { user: 'john' } });
        }
    };
};

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

console.log(server.auth.api.default.settings.x);    // 5
```

### `server.auth.default(options)`

Sets a default strategy which is applied to every route where:
- `options` - a string with the default strategy name or an object with a specified strategy or
 strategies using the same format as the [route `auth` handler options](#route.config.auth).

The default does not apply when the route config specifies `auth` as `false`, or has an
authentication strategy configured (contains the `strategy` or `strategies` authentication settings).
Otherwise, the route authentication config is applied to the defaults.

Note that if the route has authentication config, the default only applies at the time of adding
the route, not at runtime. This means that calling `default()` after adding a route with some
authentication config will have no impact on the routes added prior. However, the default will
apply to routes added before `default()` is called if those routes lack any authentication config.

The default auth strategy configuration can be accessed via `connection.auth.settings.default`. To
obtain the active authentication configuration of a route, use `connection.auth.lookup(request.route)`.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');
server.auth.default('default');

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {

        return reply(request.auth.credentials.user);
    }
});
```

### `server.auth.scheme(name, scheme)`

Registers an authentication scheme where:
- `name` - the scheme name.
- `scheme` - the method implementing the scheme with signature `function(server, options)` where:
    - `server` - a reference to the server object the scheme is added to.
    - `options` - optional scheme settings used to instantiate a strategy.

The `scheme` method must return an object with the following keys:
- `api` - optional object which is exposed via the [`server.auth.api`](#serverauthapi) object.
- `authenticate(request, reply)` - required function called on each incoming request configured
  with the authentication scheme where:
    - `request` - the [request object](#request-object).
    - `reply` - the [reply interface](#reply-interface) the authentication method must call when
      done authenticating the request where:
        - `reply(err, response, result)` - is called if authentication failed where:
            - `err` - any authentication error.
            - `response` - any authentication response action such as redirection. Ignored if `err`
              is present, otherwise required.
            - `result` - an object containing:
                - `credentials` - the authenticated credentials.
                - `artifacts` - optional authentication artifacts.
        - `reply.continue(result)` - is called if authentication succeeded where:
            - `result` - same object as `result` above.
- `payload(request, reply)` - optional function called to authenticate the request payload where:
    - `request` - the [request object](#request-object).
    - `reply(err, response)` - is called if authentication failed where:
        - `err` - any authentication error.
        - `response` - any authentication response action such as redirection. Ignored if `err`
            is present, otherwise required.
    - `reply.continue()` - is called if payload authentication succeeded.
- `response(request, reply)` - optional function called to decorate the response with
  authentication headers before the response headers or payload is written where:
    - `request` - the [request object](#request-object).
    - `reply(err, response)` - is called if an error occurred where:
        - `err` - any authentication error.
        - `response` - any authentication response to send instead of the current response. Ignored
          if `err` is present, otherwise required.
    - `reply.continue()` - is called if the operation succeeded.
- `options` - an optional object with the following keys:
    - `payload` - if `true`, requires payload validation as part of the scheme and forbids routes
      from disabling payload auth validation. Defaults to `false`.

When the scheme `authenticate()` method implementation calls `reply()` with an error condition,
the specifics of the error affect whether additional authentication strategies will be attempted
(if configured for the route). If the `err` passed to the `reply()` method includes a message, no
additional strategies will be attempted. If the `err` does not include a message but does include
the scheme name (e.g. `Boom.unauthorized(null, 'Custom')`), additional strategies will be attempted
in the order of preference (defined in the route configuration). If authentication fails the
scheme names will be present in the 'WWW-Authenticate' header.

When the scheme `payload()` method returns an error with a message, it means payload validation
failed due to bad payload. If the error has no message but includes a scheme name (e.g.
`Boom.unauthorized(null, 'Custom')`), authentication may still be successful if the route
`auth.payload` configuration is set to `'optional'`.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

const scheme = function (server, options) {

    return {
        authenticate: function (request, reply) {

            const req = request.raw.req;
            const authorization = req.headers.authorization;
            if (!authorization) {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            return reply.continue({ credentials: { user: 'john' } });
        }
    };
};

server.auth.scheme('custom', scheme);
```

### `server.auth.strategy(name, scheme, [mode], [options])`

Registers an authentication strategy where:
- `name` - the strategy name.
- `scheme` - the scheme name (must be previously registered using
  [`server.auth.scheme()`](#serverauthschemename-scheme)).
- `mode` - if set to `true` (which is the same as `'required'`) or to a valid authentication mode (`'required'`, `'optional'`,
  `'try'`), the scheme is automatically assigned as the default strategy for any route without an `auth` config. Can only be
  assigned to a single server strategy. Defaults to `false` (no default settings).
- `options` - scheme options based on the scheme requirements.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

server.route({
    method: 'GET',
    path: '/',
    config: {
        auth: 'default',
        handler: function (request, reply) {

            return reply(request.auth.credentials.user);
        }
    }
});
```

### `server.auth.test(strategy, request, next)`

Tests a request against an authentication strategy where:
- `strategy` - the strategy name registered with
  [`server.auth.strategy()`](#serverauthstrategyname-scheme-mode-options).
- `request` - the [request object](#request-object).
- `next` - the callback function with signature `function(err, credentials)` where:
    - `err` - the error if authentication failed.
    - `credentials` - the authentication credentials object if authentication was successful.

Note that the `test()` method does not take into account the route authentication configuration. It
also does not perform payload authentication. It is limited to the basic strategy authentication
execution. It does not include verifying scope, entity, or other route properties.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

server.auth.scheme('custom', scheme);
server.auth.strategy('default', 'custom');

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {

        request.server.auth.test('default', request, (err, credentials) => {

            if (err) {
                return reply({ status: false });
            }

            return reply({ status: true, user: credentials.name });
        });
    }
});
```

### `server.bind(context)`

Sets a global context used as the default bind object when adding a route or an extension where:
- `context` - the object used to bind `this` in handler and
  [extension methods](#serverextevent-method-options).

When setting context inside a plugin, the context is applied only to methods set up by the plugin.
Note that the context applies only to routes and extensions added after it has been set. Ignored if
the method being bound is an arrow function.

```js
const handler = function (request, reply) {

    return reply(this.message);
};

exports.register = function (server, options, next) {

    const bind = {
        message: 'hello'
    };

    server.bind(bind);
    server.route({ method: 'GET', path: '/', handler: handler });
    return next();
};
```

### `server.cache(options)`

Provisions a cache segment within the server cache facility where:
- `options` - [**catbox** policy](https://github.com/hapijs/catbox#policy) configuration where:
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was
      saved in the cache. Cannot be used together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'HH:MM' format, at which point
      all cache records expire. Uses local time. Cannot be used together with `expiresIn`.
    - `generateFunc` - a function used to generate a new cache item if one is not found in the
      cache when calling `get()`. The method's signature is `function(id, next)` where:
          - `id` - the `id` string or object provided to the `get()` method.
          - `next` - the method called when the new item is returned with the signature
            `function(err, value, ttl)` where:
              - `err` - an error condition.
              - `value` - the new value generated.
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
    - `cache` - the cache name configured in [`server.cache`](#server.config.cache). Defaults to
      the default cache.
    - `segment` - string segment name, used to isolate cached items within the cache partition.
      When called within a plugin, defaults to '!name' where 'name' is the plugin name. When called
      within a server method, defaults to '#name' where 'name' is the server method name. Required
      when called outside of a plugin.
    - `shared` - if `true`, allows multiple cache provisions to share the same segment. Default to
      `false`.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

const cache = server.cache({ segment: 'countries', expiresIn: 60 * 60 * 1000 });
cache.set('norway', { capital: 'oslo' }, null, (err) => {

    cache.get('norway', (err, value, cached, log) => {

        // value === { capital: 'oslo' };
    });
});
```

### `server.cache.provision(options, [callback])`

Provisions a server cache as described in [`server.cache`](#server.config.cache) where:
- `options` - same as the server `cache` configuration options.
- `callback` - the callback method when cache provisioning is completed or failed with the
  signature `function(err)` where:
    - `err` - any cache startup error condition.

If no `callback` is provided, a `Promise` object is returned.

Note that if the server has been initialized or started, the cache will be automatically started
to match the state of any other provisioned server cache.

```js
const server = new Hapi.Server();
server.connection({ port: 80 });

server.initialize((err) => {

    server.cache.provision({ engine: require('catbox-memory'), name: 'countries' }, (err) => {

        const cache = server.cache({ cache: 'countries', expiresIn: 60 * 60 * 1000 });
        cache.set('norway', { capital: 'oslo' }, null, (err) => {

            cache.get('norway', (err, value, cached, log) => {

                // value === { capital: 'oslo' };
            });
        });
    });
});
```

### `server.connection([options])`

Adds an incoming server connection where:
- `options` - a connection configuration object or array of objects with the following optional keys:
	- `host` - the public hostname or IP address. Used only to set `server.info.host` and
	  `server.info.uri`. If not configured, defaults to the operating system hostname and if not
	  available, to `'localhost'`.
	- `address` - sets the host name or IP address the connection will listen on. If not configured,
	  defaults to `host` if present, otherwise to all available network interfaces (i.e. `'0.0.0.0'`).
	  Set to `127.0.0.1` or `localhost` to restrict connection to only those coming from the same
	  machine.
	- `port` - the TCP port the connection will listen to. Defaults to an ephemeral port (`0`) which
	  uses an available port when the server is started (and assigned to `server.info.port`). If `port`
	  is a string containing a '/' character, it is used as a UNIX domain socket path and if it starts
	  with '\\.\pipe' as a Windows named pipe.
	- `uri` - the full public URI without the path (e.g. 'http://example.com:8080'). If present, used
	  as the connection `info.uri` otherwise constructed from the connection settings.
	- `listener` - optional node.js HTTP (or HTTPS)
	  [`http.Server`](http://nodejs.org/api/http.html#http_class_http_server) object or any compatible
	  object. If the `listener` needs to be manually started, set `autoListen` to `false`. If the
	  `listener` uses TLS, set `tls` to `true`.
	- `autoListen` - indicates that the `connection.listener` will be started manually outside the
	  framework. Cannot be specified with a `port` setting. Defaults to `true`.
	- `labels` - a string or string array of labels used to [`server.select()`](#serverselectlabels)
	  specific connections matching the specified labels. Defaults to an empty array `[]` (no labels).
	- `tls` - used to create an HTTPS connection. The `tls` object is passed unchanged as options to
	  the node.js HTTPS server as described in the
	  [node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).
	  Set to `true` when passing a `listener` object that has been configured to use TLS directly.
	- Any [connections configuration server defaults](#server.config.connections) can be included to
	  override and customize the individual connection.

Returns a server object with the new connections selected.

Must be called before any other server method that modifies connections is called for it to apply
to the new connection (e.g. [`server.state()`](#serverstatename-options)).

Note that the `options` object is deeply cloned (with the exception of `listener` which is
shallowly copied) and cannot contain any values that are unsafe to perform deep copy on.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();

const web = server.connection({ port: 8000, host: 'example.com', labels: ['web'] });
const admin = server.connection({ port: 8001, host: 'example.com', labels: ['admin'] });

// server.connections.length === 2
// web.connections.length === 1
// admin.connections.length === 1
```

Special care must be taken when adding connections inside a plugin `register()` method. Because
plugin connections selection happens before registration, any connection added inside the plugin
will not be included in the `server.connections` array. For this reason, the `server` object
provided to the `register()` method does not support the `connection()` method.

However, connectionless plugins (plugins with `attributes.connections` set to `false`) provide
a powerful bridge and allow plugins to add connections. This is done by using the `register()`
`server` argument only for adding the new connection using `server.connection()` and then
using the return value from the `connection()` method (which is another `server` with the new
connection selected) to perform any other actions that should include the new connection (only).

While this pattern can be accomplished without setting the plugin to connectionless mode, it
makes the code safer and easier to maintain because it will prevent trying to use the `server`
argument to manage the new connection and will throw an exception (instead of just failing
silently). Without setting the plugin to connectionless mode, you must use
`server.root.connection()` which will return a `server` object scoped for the root realm, not
the current plugin.

For example:
```js
exports.register = function (srv, options, next) {

    // Use the 'srv' argument to add a new connection

    const server = srv.connection();

    // Use the 'server' return value to manage the new connection

    server.route({
        path: '/',
        method: 'GET',
        handler: function (request, reply) {

            return reply('hello');
        }
    });

    return next();
};

exports.register.attributes = {
    name: 'example',
    connections: false
};
```

### `server.decoder(encoding, decoder)`

Registers a custom content decoding compressor to extend the built-in support for `'gzip'` and
'`deflate`' where:
- `encoding` - the decoder name string.
- `decoder` - a function using the signature `function(options)` where `options` are the encoding specific options configured in
  the route `payload.compression` configuration option, and the return value is an object compatible with the output of node's
  [`zlib.createGunzip()`](https://nodejs.org/dist/latest-v6.x/docs/api/zlib.html#zlib_zlib_creategunzip_options).

```js
const Zlib = require('zlib');
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, routes: { payload: { compression: { special: { chunkSize: 16 * 1024 } } } } });

server.decoder('special', (options) => Zlib.createGunzip(options));
```

### `server.decorate(type, property, method, [options])`

Extends various framework interfaces with custom methods where:
- `type` - the interface being decorated. Supported types:
    - `'request'` - adds methods to the [Request object](#request-object).
    - `'reply'` - adds methods to the [reply interface](#reply-interface).
    - `'server'` - adds methods to the [Server](#server) object.
- `property` - the object decoration key name.
- `method` - the extension function or other value.
- `options` - if the `type` is `'request'`, supports the following optional settings:
    - `apply` - if `true`, the `method` function is invoked using the signature `function(request)`
      where `request` is the current request object and the returned value is assigned as the
      decoration.

Note that decorations apply to the entire server and all its connections regardless of current
selection.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const success = function () {

    return this.response({ status: 'ok' });
};

server.decorate('reply', 'success', success);

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {

        return reply.success();
    }
});
```

### `server.dependency(dependencies, [after])`

Used within a plugin to declare a required dependency on other [plugins](#plugins) where:
- `dependencies` - a single string or array of plugin name strings which must be registered in
  order for this plugin to operate. Plugins listed must be registered before the server is initialized or started.
  Does not provide version dependency which should be implemented using
  [npm peer dependencies](http://blog.nodejs.org/2013/02/07/peer-dependencies/).
- `after` - an optional function called after all the specified dependencies have been registered
  and before the server starts. The function is only called if the server is initialized or started. If a circular
  dependency is detected, an exception is thrown (e.g. two plugins each has an `after` function
  to be called after the other). The function signature is `function(server, next)` where:
    - `server` - the server the `dependency()` method was called on.
    - `next` - the callback function the method must call to return control over to the application
      and complete the registration process. The function signature is `function(err)` where:
        - `err` - internal error condition, which is returned back via the
          [`server.initialize()`](#serverinitializecallback) or [`server.start()`](#serverstartcallback) callback.

The `after` method is identical to setting a server extension point on `'onPreStart'`. Connectionless
plugins (those with `attributes.connections` set to `false`) can only depend on other connectionless
plugins (server initialization will fail even of the dependency is loaded but is not connectionless).

```js
const after = function (server, next) {

    // Additional plugin registration logic
    return next();
};

exports.register = function (server, options, next) {

    server.dependency('yar', after);
    return next();
};
```

Dependencies can also be set via the register `attributes` property (does not support setting
`after`):

```js
exports.register = function (server, options, next) {

    return next();
};

register.attributes = {
    name: 'test',
    version: '1.0.0',
    dependencies: 'yar'
};
```

### `server.emit(criteria, data, [callback])`

Emits a custom application event update to all the subscribed listeners where:
- `criteria` - the event update criteria which must be one of:
    - the event name string.
    - an object with the following optional keys (unless noted otherwise):
        - `name` - the event name string (required).
        - `channel` - the channel name string.
        - `tags` - a tag string or array of tag strings.
- `data` - the value emitted to the subscribers. If `data` is a function, the function signature
  is `function()` and it called once to generate (return value) the actual data emitted to the
  listeners. If no listeners match the event, the `data` function is not invoked.
- `callback` - an optional callback method invoked when all subscribers have been notified using the
  signature `function()`. The callback is called only after all the listeners have been notified,
  including any event updates emitted earlier (the order of event updates are guaranteed to be in the
  order they were emitted).

Note that events must be registered before they can be emitted or subscribed to by calling [`server.event(events)`](#servereventevents).
This is done to detect event name misspelling and invalid event activities.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.event('test');
server.on('test', (update) => console.log(update));
server.emit('test', 'hello');
```

### `server.encoder(encoding, encoder)`

Registers a custom content encoding compressor to extend the built-in support for `'gzip'` and
'`deflate`' where:
- `encoding` - the encoder name string.
- `encoder` - a function using the signature `function(options)` where `options` are the encoding specific options configured in
  the route `compression` configuration option, and the return value is an object compatible with the output of node's
  [`zlib.createGzip()`](https://nodejs.org/dist/latest-v6.x/docs/api/zlib.html#zlib_zlib_creategzip_options).

```js
const Zlib = require('zlib');
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, routes: { compression: { special: { chunkSize: 16 * 1024 } } } });

server.encoder('special', (options) => Zlib.createGzip(options));
```

### `server.event(events)`

Register custom application events where:
- `events` - must be one of:
    - an event name string.
    - an event options object with the following optional keys (unless noted otherwise):
        - `name` - the event name string (required).
        - `channels` - a string or array of strings specifying the event channels available.
          Defaults to no channel restrictions (event updates can specify a channel or not).
        - `clone` - if `true`, the `data` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
          is cloned before it is passed to the listeners (unless an override specified by each
          listener). Defaults to `false` (`data` is passed as-is).
        - `spread` - if `true`, the `data` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
          must be an array and the `listener` method is called with each array element passed as a
          separate argument (unless an override specified by each listener). This should only be
          used when the emitted data structure is known and predictable. Defaults to `false` (`data`
          is emitted as a single argument regardless of its type).
        - `tags` - if `true` and the `criteria` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
          includes `tags`, the tags are mapped to an object (where each tag string is the key and
          the value is `true`) which is appended to the arguments list at the end (but before
          the `callback` argument if `block` is set). A configuration override can be set by each
          listener. Defaults to `false`.
        - `shared` - if `true`, the same event `name` can be registered multiple times where the
          second registration is ignored. Note that if the registration config is changed between
          registrations, only the first configuration is used. Defaults to `false` (a duplicate
          registration will throw an error).
    - a [**podium**](https://github.com/hapijs/podium) emitter object.
    - an array containing any of the above.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.event('test');
server.on('test', (update) => console.log(update));
server.emit('test', 'hello');
```

### `server.expose(key, value)`

Used within a plugin to expose a property via `server.plugins[name]` where:
- `key` - the key assigned (`server.plugins[name][key]`).
- `value` - the value assigned.

```js
exports.register = function (server, options, next) {

    server.expose('util', function () { console.log('something'); });
    return next();
};
```

### `server.expose(obj)`

Merges an object into to the existing content of `server.plugins[name]` where:
- `obj` - the object merged into the exposed properties container.

```js
exports.register = function (server, options, next) {

    server.expose({ util: function () { console.log('something'); } });
    return next();
};
```

Note that all properties of `obj` are deeply cloned into `server.plugins[name]`, so you should avoid using this method for exposing large objects that may be expensive to clone or singleton objects such as database client objects. Instead favor the `server.expose(key, value)` form, which only copies a reference to `value`.

### `server.ext(events)`

Registers an extension function in one of the available extension points where:
- `events` - an object or array of objects with the following:
    - `type` - the extension point event name. The available extension points include the
      [request extension points](#request-lifecycle) as well as the following server extension points:
        - `'onPreStart'` - called before the connection listeners are started.
        - `'onPostStart'` - called after the connection listeners are started.
        - `'onPreStop'` - called before the connection listeners are stopped.
        - `'onPostStop'` - called after the connection listeners are stopped.
    - `method` - a function or an array of functions to be executed at a specified point during request
      processing. The required extension function signature is:
        - server extension points: `function(server, next)` where:
            - `server` - the server object.
            - `next` - the continuation method with signature `function(err)`.
            - `this` - the object provided via `options.bind` or the current active context set with
              [`server.bind()`](#serverbindcontext).
        - request extension points: `function(request, reply)` where:
            - `request` - the [request object](#request-object).
            - `reply` - the [reply interface](#reply-interface) which is used to return control back to the
              framework. To continue normal execution of the [request lifecycle](#request-lifecycle),
              `reply.continue()` must be called. If the extension type is `'onPostHandler'` or
              `'onPreResponse'`, a single argument passed to `reply.continue()` will override the
              current set response (including all headers) but will not stop the request lifecycle
              execution. To abort processing and return a response to the client, call `reply(value)`
              where value is an error or any other valid response.
            - `this` - the object provided via `options.bind` or the current active context set with
              [`server.bind()`](#serverbindcontext).
    - `options` - an optional object with the following:
        - `before` - a string or array of strings of plugin names this method must execute before (on
          the same event). Otherwise, extension methods are executed in the order added.
        - `after` - a string or array of strings of plugin names this method must execute after (on the
          same event). Otherwise, extension methods are executed in the order added.
        - `bind` - a context object passed back to the provided method (via `this`) when called.
           Ignored if the method is an arrow function.
        - `sandbox` - if set to `'plugin'` when adding a [request extension points](#request-lifecycle)
          the extension is only added to routes defined by the current plugin. Not allowed when
          configuring route-level extensions, or when adding server extensions. Defaults to
          `'connection'` which applies to any route added to the connection the extension is added
          to.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.ext({
    type: 'onRequest',
    method: function (request, reply) {

        // Change all requests to '/test'
        request.setUrl('/test');
        return reply.continue();
    }
});

const handler = function (request, reply) {

    return reply({ status: 'ok' });
};

server.route({ method: 'GET', path: '/test', handler: handler });
server.start((err) => { });

// All requests will get routed to '/test'
```

### `server.ext(event, method, [options])`

Registers a single extension event using the same properties as used in
[`server.ext(events)`](#serverextevents), but passed as arguments.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.ext('onRequest', function (request, reply) {

    // Change all requests to '/test'
    request.setUrl('/test');
    return reply.continue();
});

const handler = function (request, reply) {

    return reply({ status: 'ok' });
};

server.route({ method: 'GET', path: '/test', handler: handler });
server.start((err) => { });

// All requests will get routed to '/test'
```

### `server.handler(name, method)`

Registers a new handler type to be used in routes where:
- `name` - string name for the handler being registered. Cannot override any previously registered
  type.
- `method` - the function used to generate the route handler using the signature
  `function(route, options)` where:
    - `route` - the [route public interface](#route-public-interface) object.
    - `options` - the configuration object provided in the handler config.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ host: 'localhost', port: 8000 });

// Defines new handler for routes on this server
const handler = function (route, options) {

    return function (request, reply) {

        return reply('new handler: ' + options.msg);
    }
};

server.handler('test', handler);

server.route({
    method: 'GET',
    path: '/',
    handler: { test: { msg: 'test' } }
});

server.start(function (err) { });
```

The `method` function can have a `defaults` object or function property. If the property is set to
an object, that object is used as the default route config for routes using this handler. If the
property is set to a function, the function uses the signature `function(method)` and returns the
route default configuration.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ host: 'localhost', port: 8000 });

const handler = function (route, options) {

    return function (request, reply) {

        return reply('new handler: ' + options.msg);
    }
};

// Change the default payload processing for this handler
handler.defaults = {
    payload: {
        output: 'stream',
        parse: false
    }
};

server.handler('test', handler);
```

### `server.initialize([callback])`

Initializes the server (starts the caches, finalizes plugin registration) but does not start listening
on the connection ports, where:
- `callback` - the callback method when server initialization is completed or failed with the signature
  `function(err)` where:
    - `err` - any initialization error condition.

If no `callback` is provided, a `Promise` object is returned.

Note that if the method fails and the callback includes an error, the server is considered to be in
an undefined state and should be shut down. In most cases it would be impossible to fully recover as
the various plugins, caches, and other event listeners will get confused by repeated attempts to
start the server or make assumptions about the healthy state of the environment. It is recommended
to assert that no error has been returned after calling `initialize()` to abort the process when the
server fails to start properly. If you must try to resume after an error, call `server.stop()`
first to reset the server state.

```js
const Hapi = require('hapi');
const Hoek = require('hoek');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.initialize((err) => {

    Hoek.assert(!err, err);
});
```

### `server.inject(options, [callback])`

When the server contains exactly one connection, injects a request into the sole connection
simulating an incoming HTTP request without making an actual socket connection. Injection is useful
for testing purposes as well as for invoking routing logic internally without the overhead or
limitations of the network stack. Utilizes the [**shot**](https://github.com/hapijs/shot) module
for performing injections, with some additional options and response properties:
- `options` - can be assigned a string with the requested URI, or an object with:
    - `method` - the request HTTP method (e.g. `'POST'`). Defaults to `'GET'`.
    - `url` - the request URL. If the URI includes an authority (e.g. `'example.com:8080'`), it is
      used to automatically set an HTTP 'Host' header, unless one was specified in `headers`.
    - `headers` - an object with optional request headers where each key is the header name and the
      value is the header content. Defaults to no additions to the default Shot headers.
    - `payload` - an optional string, buffer or object containing the request payload. In case of an object it will be converted to a string for you. Defaults to no payload. Note that payload processing
      defaults to `'application/json'` if no 'Content-Type' header provided.
    - `credentials` - an optional credentials object containing authentication information. The
      `credentials` are used to bypass the default authentication strategies, and are validated
      directly as if they were received via an authentication scheme. Defaults to no credentials.
    - `artifacts` - an optional artifacts object containing authentication artifact information. The
      `artifacts` are used to bypass the default authentication strategies, and are validated
      directly as if they were received via an authentication scheme. Ignored if set without
      `credentials`. Defaults to no artifacts.
    - `app` - sets the initial value of `request.app`, defaults to `{}`.
    - `plugins` - sets the initial value of `request.plugins`, defaults to `{}`.
    - `allowInternals` - allows access to routes with `config.isInternal` set to `true`. Defaults to
      `false`.
    - `remoteAddress` - sets the remote address for the incoming connection.
    - `simulate` - an object with options used to simulate client request stream conditions for
      testing:
        - `error` - if `true`, emits an `'error'` event after payload transmission (if any).
          Defaults to `false`.
        - `close` - if `true`, emits a `'close'` event after payload transmission (if any).
          Defaults to `false`.
        - `end` - if `false`, does not end the stream. Defaults to `true`.
        - `split` - indicates whether the request payload will be split into chunks. Defaults to `undefined`, meaning payload will not be chunked.
    - `validate` - if `false`, the `options` inputs are not validated. This is recommended for run-time
      usage of `inject()` to make it perform faster where input validation can be tested separately.
- `callback` - the callback function with signature `function(res)` where:
    - `res` - the response object where:
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
        - `request` - the [request object](#request-object).

If no `callback` is provided, a `Promise` object is returned.  The promise will
only ever be resolved and never rejected.  Use the `statusCode` to determine if
the request was successful.

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.inject()`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const handler = function (request, reply) {

    return reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: handler });

server.inject('/', (res) => {

    console.log(res.result);
});
```

### `server.log(tags, [data, [timestamp]])`

Logs server events that cannot be associated with a specific request. When called the server emits
a `'log'` event which can be used by other listeners or [plugins](#plugins) to record the
information or output to the console. The arguments are:
- `tags` - a string or an array of strings (e.g. `['error', 'database', 'read']`) used to identify
  the event. Tags are used instead of log levels and provide a much more expressive mechanism for
  describing and filtering events. Any logs generated by the server internally include the `'hapi'`
  tag along with event-specific information.
- `data` - an optional message string or object with the application data being logged. If `data`
  is a function, the function signature is `function()` and it called once to generate (return
  value) the actual data emitted to the listeners. If no listeners match the event, the `data`
  function is not invoked.

- `timestamp` - an optional timestamp expressed in milliseconds. Defaults to `Date.now()` (now).

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.on('log', (event, tags) => {

    if (tags.error) {
        console.log(event);
    }
});

server.log(['test', 'error'], 'Test event');
```

### `server.lookup(id)`

When the server contains exactly one connection, looks up a route configuration where:
- `id` - the route identifier as set in the [route options](#route-options).

returns the [route public interface](#route-public-interface) object if found, otherwise `null`.

```js
const server = new Hapi.Server();
server.connection();
server.route({
    method: 'GET',
    path: '/',
    config: {
        handler: function (request, reply) {

            return reply();
        },
        id: 'root'
    }
});

const route = server.lookup('root');
```

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.lookup()` method.

### `server.match(method, path, [host])`

When the server contains exactly one connection, looks up a route configuration where:
- `method` - the HTTP method (e.g. 'GET', 'POST').
- `path` - the requested path (must begin with '/').
- `host` - optional hostname (to match against routes with `vhost`).

returns the [route public interface](#route-public-interface) object if found, otherwise `null`.

```js
const server = new Hapi.Server();
server.connection();
server.route({
    method: 'GET',
    path: '/',
    config: {
        handler: function (request, reply) {

            return reply();
        },
        id: 'root'
    }
});

const route = server.match('get', '/');
```

When the server contains more than one connection, each [`server.connections`](#serverconnections)
array member provides its own `connection.match()` method.

### `server.method(name, method, [options])`

Registers a server method. Server methods are functions registered with the server and used
throughout the application as a common utility. Their advantage is in the ability to configure them
to use the built-in cache and share across multiple request handlers without having to create a
common module.

Methods are registered via `server.method(name, method, [options])` where:
- `name` - a unique method name used to invoke the method via `server.methods[name]`.
  Supports using nested names such as `utils.users.get` which will automatically
  create the missing path under [`server.methods`](#servermethods) and can be accessed
  for the previous example via `server.methods.utils.users.get`.
  When configured with caching enabled, `server.methods[name].cache` will be an object
  with the following properties and methods:
    - `drop(arg1, arg2, ..., argn, callback)` - function that can be used to clear the cache for a given key.
    - `stats` - an object with cache statistics, see stats documentation for **catbox**.
- `method` - the method function with the signature is one of:
    - `function(arg1, arg2, ..., argn, next)` where:
        - `arg1`, `arg2`, etc. - the method function arguments.
        - `next` - the function called when the method is done with the signature
          `function(err, result, [ttl])` where:
            - `err` - error response if the method failed.
            - `result` - the return value.
            - `ttl` - `0` if result is valid but cannot be cached. Defaults to cache policy.
    - `function(arg1, arg2, ..., argn)` where:
        - `arg1`, `arg2`, etc. - the method function arguments.
        - the `callback` option is set to `false`.
        - the method must return a value (result, `Error`, or a promise) or throw an `Error`.
- `options` - optional configuration:
    - `bind` - a context object passed back to the method function (via `this`) when called.
      Defaults to active context (set via [`server.bind()`](#serverbindcontext) when the method is
      registered. Ignored if the method is an arrow function.
    - `cache` - the same cache configuration used in [`server.cache()`](#servercacheoptions). The
      `generateTimeout` option is required.
    - `callback` - if `false`, expects the `method` to be a synchronous function. Note that using a
      synchronous function with caching will convert the method interface to require a callback as
      an additional argument with the signature `function(err, result, cached, report)` since the
      cache interface cannot return values synchronously. Defaults to `true`.
    - `generateKey` - a function used to generate a unique key (for caching) from the arguments
      passed to the method function (the callback argument is not passed as input). The server
      will automatically generate a unique key if the function's arguments are all of types
      `'string'`, `'number'`, or `'boolean'`. However if the method uses other types of arguments,
      a key generation function must be provided which takes the same arguments as the function and
      returns a unique string (or `null` if no key can be generated).

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

// Simple arguments

const add = function (a, b, next) {

    return next(null, a + b);
};

server.method('sum', add, { cache: { expiresIn: 2000, generateTimeout: 100 } });

server.methods.sum(4, 5, (err, result) => {

    console.log(result);
});

// Object argument

const addArray = function (array, next) {

    let sum = 0;
    array.forEach((item) => {

        sum += item;
    });

    return next(null, sum);
};

server.method('sumObj', addArray, {
    cache: { expiresIn: 2000, generateTimeout: 100 },
    generateKey: function (array) {

        return array.join(',');
    }
});

server.methods.sumObj([5, 6], (err, result) => {

    console.log(result);
});

// Synchronous method with cache

const addSync = function (a, b) {

    return a + b;
};

server.method('sumSync', addSync, { cache: { expiresIn: 2000, generateTimeout: 100 }, callback: false });

server.methods.sumSync(4, 5, (err, result) => {

    console.log(result);
});
```

### `server.method(methods)`

Registers a server method function as described in
[`server.method()`](#servermethodname-method-options) using a configuration object
where:
- `methods` - an object or an array of objects where each one contains:
    - `name` - the method name.
    - `method` - the method function.
    - `options` - optional settings.

```js
const add = function (a, b, next) {

    next(null, a + b);
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

## `server.on(criteria, listener)`

Subscribe a handler to an event where:
- `criteria` - the subscription criteria which must be one of:
    - event name string which can be any of the [built-in server events](#server-events) or a custom
      application event registered with [`server.event(events)`](#servereventevents).
    - a criteria object with the following optional keys (unless noted otherwise):
        - `name` - the event name string (required).
        - `block` - if `true`, the `listener` method receives an additional `callback` argument
          which must be called when the method completes. No other event will be emitted until the
          `callback` methods is called. The method signature is `function()`. If `block` is set to
          a positive integer, the value is used to set a timeout after which any pending events
          will be emitted, ignoring the eventual call to `callback`. Defaults to `false` (non
          blocking).
        - `channels` - a string or array of strings specifying the event channels to subscribe to.
          If the event registration specified a list of allowed channels, the `channels` array must
          match the allowed channels. If `channels` are specified, event updates without any
          channel designation will not be included in the subscription. Defaults to no channels
          filter.
        - `clone` - if `true`, the `data` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
           is cloned before it is passed to the `listener` method. Defaults to the event
           registration option (which defaults to `false`).
        - `count` - a positive integer indicating the number of times the `listener` can be called
          after which the subscription is automatically removed. A count of `1` is the same as
          calling `server.once()`. Defaults to no limit.
        - `filter` - the event tags (if present) to subscribe to which can be one of:
            - a tag string.
            - an array of tag strings.
            - an object with the following:
                - `tags` - a tag string or array of tag strings.
                - `all` - if `true`, all `tags` must be present for the event update to match the
                  subscription. Defaults to `false` (at least one matching tag).
        - `spread` - if `true`, and the `data` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
          is an array, the `listener` method is called with each array element passed as a separate
          argument. This should only be used when the emitted data structure is known and predictable.
          Defaults to the event registration option (which defaults to `false`).
        - `tags` - if `true` and the `criteria` object passed to [`server.emit()`](#serveremitcriteria-data-callback)
          includes `tags`, the tags are mapped to an object (where each tag string is the key and
          the value is `true`) which is appended to the arguments list at the end (but before
          the `callback` argument if `block` is set). Defaults to the event registration option
          (which defaults to `false`).
- `listener` - the handler method set to receive event updates. The function signature depends
  on the `block`, `spread`, and `tags` options.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.event('test');
server.on('test', (update) => console.log(update));
server.emit('test', 'hello');
```

## `server.once(criteria, listener)`

Same as calling [`server.on()`](#serveroncriteria-listener) with the `count` option set to `1`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.event('test');
server.once('test', (update) => console.log(update));
server.emit('test', 'hello');
server.emit('test', 'hello');       // Ignored
```

### `server.path(relativeTo)`

Sets the path prefix used to locate static resources (files and view templates) when relative paths
are used where:
- `relativeTo` - the path prefix added to any relative file path starting with `'.'`.

Note that setting a path within a plugin only applies to resources accessed by plugin methods.
If no path is set, the connection `files.relativeTo` configuration is used. The path only applies
to routes added after it has been set.

```js
exports.register = function (server, options, next) {

    // Assuming the Inert plugin was registered previously

    server.path(__dirname + '../static');
    server.route({ path: '/file', method: 'GET', handler: { file: './test.html' } });
    next();
};
```

### `server.register(plugins, [options], [callback])`

Registers a plugin where:
- `plugins` - an object or array of objects where each one is either:
    - a plugin registration function.
    - an object with the following:
        - `register` - the plugin registration function.
        - `options` - optional options passed to the plugin during registration.
        - `once`, `select`, `routes` - optional plugin-specific registration options as defined below.
- `options` - optional registration options (different from the options passed to the registration
  function):
    - `once` - if `true`, the registration is skipped for any connection already registered with.
      Cannot be used with plugin options. If the plugin does not have a `connections` attribute set
      to `false` and the registration selection is empty, registration will be skipped as no connections
      are available to register once. Defaults to `false`.
    - `routes` - modifiers applied to each route added by the plugin:
        - `prefix` - string added as prefix to any route path (must begin with `'/'`). If a plugin
          registers a child plugin the `prefix` is passed on to the child or is added in front of
          the child-specific prefix.
        - `vhost` - virtual host string (or array of strings) applied to every route. The
          outer-most `vhost` overrides the any nested configuration.
    - `select` - a string or array of string labels used to pre-select connections for plugin
      registration.
- `callback` - the callback function with signature `function(err)` where:
    - `err` - an error returned from the registration function. Note that exceptions thrown by the
      registration function are not handled by the framework.

If no `callback` is provided, a `Promise` object is returned.

Note that plugin registration are recorded on each of the available connections. When plugins
express a dependency on other plugins, both have to be loaded into the same connections for the
dependency requirement to be fulfilled. It is recommended that plugin registration happen after
all the server connections are created via `server.connection()`.

```js
server.register({
    register: require('plugin_name'),
    options: {
        message: 'hello'
    }
 }, (err) => {

     if (err) {
         console.log('Failed loading plugin');
     }
 });
```

### `server.route(options)`

Adds a connection route where:
- `options` - a [route configuration object](#route-configuration) or an array of configuration
  objects.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('ok'); } });
server.route([
    { method: 'GET', path: '/1', handler: function (request, reply) { return reply('ok'); } },
    { method: 'GET', path: '/2', handler: function (request, reply) { return reply('ok'); } }
]);
```

### `server.select(labels)`

Selects a subset of the server's connections where:
- `labels` - a single string or array of strings of labels used as a logical OR statement to select
  all the connections with matching labels in their configuration.

Returns a server object with `connections` set to the requested subset. Selecting again on a
selection operates as a logic AND statement between the individual selections.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, labels: ['a', 'b'] });
server.connection({ port: 8080, labels: ['a', 'c'] });
server.connection({ port: 8081, labels: ['b', 'c'] });

const a = server.select('a');     // 80, 8080
const ac = a.select('c');         // 8080
```

### `server.start([callback])`

Starts the server connections by listening for incoming requests on the configured port of each
listener (unless the connection was configured with `autoListen` set to `false`), where:
- `callback` - the callback method when server startup is completed or failed with the signature
  `function(err)` where:
    - `err` - any startup error condition.

If no `callback` is provided, a `Promise` object is returned.

Note that if the method fails and the callback includes an error, the server is considered to be in
an undefined state and should be shut down. In most cases it would be impossible to fully recover as
the various plugins, caches, and other event listeners will get confused by repeated attempts to
start the server or make assumptions about the healthy state of the environment. It is recommended
to assert that no error has been returned after calling `start()` to abort the process when the
server fails to start properly. If you must try to resume after a start error, call `server.stop()`
first to reset the server state.

If a started server is started again, the second call to `start()` will only start new connections
added after the initial `start()` was called. No events will be emitted and no extension points
invoked.

```js
const Hapi = require('hapi');
const Hoek = require('hoek');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.start((err) => {

    Hoek.assert(!err, err);
    console.log('Server started at: ' + server.info.uri);
});
```

### `server.state(name, [options])`

[HTTP state management](http://tools.ietf.org/html/rfc6265) uses client cookies to persist a state
across multiple requests. Registers a cookie definitions where:
- `name` - the cookie name string.
- `options` - are the optional cookie settings:
    - `ttl` - time-to-live in milliseconds. Defaults to `null` (session time-life - cookies are
      deleted when the browser is closed).
    - `isSecure` - sets the 'Secure' flag. Defaults to `true`.
    - `isHttpOnly` - sets the 'HttpOnly' flag. Defaults to `true`.
    - `isSameSite` - sets the ['SameSite' flag](https://www.owasp.org/index.php/SameSite).  The value must be one of:
        - `false` - no flag.
        - `'Strict'` - sets the value to `'Strict'` (this is the default value).
        - `'Lax'` - sets the value to `'Lax'`.
    - `path` - the path scope. Defaults to `null` (no path).
    - `domain` - the domain scope. Defaults to `null` (no domain).
    - `autoValue` - if present and the cookie was not received from the client or explicitly set by
      the route handler, the cookie is automatically added to the response with the provided value.
      The value can be a function with signature `function(request, next)` where:
        - `request` - the [request object](#request-object).
        - `next` - the continuation function using the `function(err, value)` signature.
    - `encoding` - encoding performs on the provided value before serialization. Options are:
        - `'none'` - no encoding. When used, the cookie value must be a string. This is the default
          value.
        - `'base64'` - string value is encoded using Base64.
        - `'base64json'` - object value is JSON-stringified then encoded using Base64.
        - `'form'` - object value is encoded using the _x-www-form-urlencoded_ method.
        - `'iron'` - Encrypts and sign the value using
          [**iron**](https://github.com/hueniverse/iron).
    - `sign` - an object used to calculate an HMAC for cookie integrity validation. This does not
      provide privacy, only a mean to verify that the cookie value was generated by the server.
      Redundant when `'iron'` encoding is used. Options are:
        - `integrity` - algorithm options. Defaults to
          [`require('iron').defaults.integrity`](https://github.com/hueniverse/iron#options).
        - `password` - password used for HMAC key generation (must be at least 32 characters long).
    - `password` - password used for `'iron'` encoding (must be at least 32 characters long).
    - `iron` - options for `'iron'` encoding. Defaults to
       [`require('iron').defaults`](https://github.com/hueniverse/iron#options).
    - `ignoreErrors` - if `true`, errors are ignored and treated as missing cookies.
    - `clearInvalid` - if `true`, automatically instruct the client to remove invalid
      cookies. Defaults to `false`.
    - `strictHeader` - if `false`, allows any cookie value including values in
      violation of [RFC 6265](https://tools.ietf.org/html/rfc6265). Defaults to `true`.
    - `passThrough` - used by proxy plugins (e.g. [**h2o2**](https://github.com/hapijs/h2o2)).

State defaults can be modified via the server `connections.routes.state` configuration option.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

// Set cookie definition

server.state('session', {
    ttl: 24 * 60 * 60 * 1000,     // One day
    isSecure: true,
    path: '/',
    encoding: 'base64json'
});

// Set state in route handler

const handler = function (request, reply) {

    let session = request.state.session;
    if (!session) {
        session = { user: 'joe' };
    }

    session.last = Date.now();

    return reply('Success').state('session', session);
};
```

Registered cookies are automatically parsed when received. Parsing rules depends on the route
[`state.parse`](#route.config.state) configuration. If an incoming registered cookie fails parsing,
it is not included in `request.state`, regardless of the `state.failAction` setting. When
`state.failAction` is set to `'log'` and an invalid cookie value is received, the server will emit
a `'request-internal'` event. To capture these errors subscribe to the `'request-internal'` events
and filter on `'error'` and `'state'` tags:

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.on('request-internal', (request, event, tags) => {

    if (tags.error && tags.state) {
        console.error(event);
    }
});
```

### `server.stop([options], [callback])`

Stops the server's connections by refusing to accept any new connections or requests (existing
connections will continue until closed or timeout), where:
- `options` - optional object with:
    - `timeout` - overrides the timeout in millisecond before forcefully terminating a connection.
      Defaults to `5000` (5 seconds).
- `callback` - optional callback method which is called once all the connections have ended and
it is safe to exit the process with signature `function(err)` where:
    - `err` - any termination error condition.

If no `callback` is provided, a `Promise` object is returned.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.stop({ timeout: 60 * 1000 }, (err) => {

    console.log('Server stopped');
});
```

### `server.table([host])`

Returns a copy of the routing table where:
- `host` - optional host to filter routes matching a specific virtual host. Defaults to all virtual
  hosts.

The return value is an array where each item is an object containing:
- `info` - the `connection.info` the connection the table was generated for.
- `labels` - the connection labels.
- `table` - an array of routes where each route contains:
    - `settings` - the route config with defaults applied.
    - `method` - the HTTP method in lower case.
    - `path` - the route path.

Note that if the server has not been started and multiple connections use port `0`, the table items
will override each other and will produce an incomplete result.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, host: 'example.com' });
server.route({ method: 'GET', path: '/example', handler: function (request, reply) { return reply(); } });

const table = server.table();
```

When calling `connection.table()` directly on each connection, the return value is the same as the
array `table` item value of an individual connection:

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, host: 'example.com' });
server.route({ method: 'GET', path: '/example', handler: function (request, reply) { return reply(); } });

const table = server.connections[0].table();

/*
    [
        {
            method: 'get',
            path: '/example',
            settings: { ... }
        }
    ]
*/
```

### Server events

The server object inherits from `Events.EventEmitter` and emits the following events:

- `'log'` - events logged with [`server.log()`](#serverlogtags-data-timestamp) and
  [server events](#server-logs) generated internally by the framework.
- `'start'` - emitted when the server is started using [`server.start()`](#serverstartcallback).
- `'stop'` - emitted when the server is stopped using [`server.stop()`](#serverstopoptions-callback).
- `'request'` - events generated by [`request.log()`](#requestlogtags-data-timestamp). Does not
  include any internally generated events.
- `'request-internal'` - [request events](#request-logs) generated internally by the framework
  (multiple events per request).
- `'request-error'` - emitted whenever an Internal Server Error (500) error response is sent.
  Note that this event is emitted only if the error response is sent to the client. If the error
  is replaced with a different response before it is sent to the client, no event is emitted.
  Single event per request.
- `'response'` - emitted after the response is sent back to the client (or when the client
  connection closed and no response sent, in which case `request.response` is `null`). Single event
  per request.
- `'tail'` - emitted when a request finished processing, including any registered tails. Single
  event per request.
- `'route'` - emitted when a route is added to a connection. Note that if a route is added to
  multiple connections at the same time, each will emit a separate event. Note that the `route`
  object must not be modified.

Note that the server object should not be used to emit application events as its internal
implementation is designed to fan events out to the various plugin selections and not for
application events.

When provided (as listed below) the `event` object includes:

- `timestamp` - the event timestamp.
- `request` - if the event relates to a request, the `request id`.
- `server` - if the event relates to a server, the `server.info.uri`.
- `tags` - an array of tags (e.g. `['error', 'http']`).
- `data` - optional event-specific information.
- `internal` -  `true` if the event was generated internally by the framework.

The `'log'` event includes the `event` object and a `tags` object (where each tag is a key with the
value `true`):

```js
server.on('log', (event, tags) => {

    if (tags.error) {
        console.log('Server error: ' + (event.data || 'unspecified'));
    }
});
```

The `'request'` and `'request-internal'` events include the [request object](#request-object), the
`event` object, and a `tags` object (where each tag is a key with the value `true`):

```js
server.on('request', (request, event, tags) => {

    if (tags.received) {
        console.log('New request: ' + request.id);
    }
});
```

The `'request-error'` event includes the [request object](#request-object) and the causing error
`err` object:

```js
server.on('request-error', (request, err) => {

    console.log('Error response (500) sent for request: ' + request.id + ' because: ' + err.message);
});
```

The `'response'` and `'tail'` events include the [request object](#request-object):

```js
server.on('response', (request) => {

    console.log('Response sent for request: ' + request.id);
});
```

The `'route'` event includes the [route public interface](#route-public-interface), the connection,
and the server object used to add the route (e.g. the result of a plugin select operation):

```js
server.on('route', (route, connection, server) => {

    console.log('New route added: ' + route.path);
});
```

#### Internal events

The following logs are generated automatically by the framework. Each event can be identified by
the combination of tags used.

##### Request logs

Emitted by the server `'request-internal'` event:
- `received` - a new request received. Includes information about the request.
- `accept-encoding` `error` - a request received contains an invalid Accept-Encoding header.
- `auth` `{strategy}` - the request successfully authenticated with the listed strategy.
- `auth` `unauthenticated` - no authentication scheme included with the request.
- `auth` `unauthenticated` `response` `{strategy}` - the authentication strategy listed returned a
  non-error response (e.g. a redirect to a login page).
- `auth` `unauthenticated` `error` `{strategy}` - the request failed to pass the listed
  authentication strategy (invalid credentials).
- `auth` `unauthenticated` `missing` `{strategy}` - the request failed to pass the listed
  authentication strategy (no credentials found).
- `auth` `unauthenticated` `try` `{strategy}` - the request failed to pass the listed
  authentication strategy in `'try'` mode and will continue.
- `auth` `scope` `error` `{strategy}` - the request authenticated but failed to meet the scope
  requirements.
- `auth` `entity` `user` `error` `{strategy}` - the request authenticated but included an
  application entity when a user entity was required.
- `auth` `entity` `app` `error` `{strategy}` - the request authenticated but included a user
  entity when an application entity was required.
- `handler` - the route handler executed. Includes the execution duration.
- `handler` `error` - the route handler returned an error. Includes the execution duration and the
  error message.
- `handler` `method` {method} - a string-shortcut handler method was executed (when cache enabled).
  Includes information about the execution including cache performance.
- `pre` `method` {method} - a string-shortcut pre method was executed (when cache enabled).
  Includes information about the execution including cache performance.
- `pre` - a pre method was executed. Includes the execution duration and assignment key.
- `pre` `error` - a pre method was executed and returned an error. Includes the execution duration,
  assignment key, and error.
- `internal` `error` - an HTTP 500 error response was assigned to the request.
- `internal` `implementation` `error` - a function provided by the user failed with an exception
  during request execution.
- `request` `closed` `error` - the request closed prematurely.
- `request` `error` - the request stream emitted an error. Includes the error.
- `request` `server` `timeout` `error` - the request took too long to process by the server.
  Includes the timeout configuration value and the duration.
- `tail` `add` - a request tail was added. Includes the tail name and id.
- `tail` `remove` - a request tail was removed. Includes the tail name and id.
- `tail` `remove` `last` - the last request tail was removed. Includes the tail name and id.
- `tail` `remove` `error` - failed to remove a request tail (already removed). Includes the tail
  name and id.
- `state` `error` - the request included an invalid cookie or cookies. Includes the cookies and
  error details.
- `state` `response` `error` - the response included an invalid cookie which prevented generating a
  valid header. Includes the error.
- `payload` `error` - failed processing the request payload. Includes the error.
- `response` - the response was sent successfully.
- `response` `error` - failed writing the response to the client. Includes the error.
- `response` `error` `close` - failed writing the response to the client due to prematurely closed
  connection.
- `response` `error` `aborted` - failed writing the response to the client due to prematurely
  aborted connection.
- `validation` `error` `{input}` - input (i.e. payload, query, params, headers) validation failed.
  Includes the error.
- `validation` `response` `error` - response validation failed. Includes the error message.

##### Server logs

Emitted by the server `'log'` event:
- `load` - logs the current server load measurements when the server rejects a request due to high
  load. The event data contains the metrics.
- `internal` `implementation` `error` - a function provided by the user failed with an exception
  during request execution. The log appears under the server logs when the exception cannot be
  associated with the request that generated it.
- `connection` `client` `error` - a `clientError` event was received from the HTTP or HTTPS
  listener. The event data is the error object received.

## Plugins

Plugins provide a way to organize the application code by splitting the server logic into smaller
components. Each plugin can manipulate the server and its connections through the standard server
interface, but with the added ability to sandbox certain properties.

A plugin is a function with the signature `function(server, options, next)` where:
- `server` - the server object the plugin is being registered to.
- `options` - optional options passed to the plugin during registration.
- `next` - a callback method the function must call to return control back to the framework to
  complete the registration process with signature `function(err)` where:
    - `err` - any plugin registration error.

The plugin function must include an `attributes` function property with the following:
- `name` - required plugin name string. The name is used as a unique key. Published
  [plugins](#plugins) should  use the same name as the name field in the 'package.json' file. Names
  must be unique within each application.
- `version` - optional plugin version. The version is only used informatively to enable other
  [plugins](#plugins) to find out the versions loaded. The version should be the same as the one
  specified in the plugin's 'package.json' file.
- `multiple` - if `true`, allows the plugin to be registered multiple times with the same server.
  Defaults to `false`.
- `dependencies` - optional string or array of string indicating a plugin dependency. Same as
  setting dependencies via [`server.dependency()`](#serverdependencydependencies-after).
- `connections` - if `false`, does not allow the plugin to call server APIs that modify the
  connections such as adding a route or configuring state. This flag allows the plugin to be
  registered before connections are added and to pass dependency requirements. When set to
  `'conditional'`, the mode is based on the presence of selected connections (if the server
  has connections, it is the same as `true`, but if no connections are available, it is the
  same as `false`). Defaults to `true`.
- `once` - if `true`, will only register the plugin once per connection (or once per server for a
  connectionless plugin). If set, overrides the `once` option passed to `server.register()`.
  Defaults to `undefined` (registration will be based on the `server.register()` option `once`).

```js
const register = function (server, options, next) {

    server.route({
        method: 'GET',
        path: '/test',
        handler: function (request, reply) {

            return reply('ok');
        }
    });

    return next();
};

register.attributes = {
    name: 'test',
    version: '1.0.0'
};
```

Alternatively, the `name` and `version` can be included via the `pkg` attribute containing the
'package.json' file for the module which already has the name and version included:

```js
register.attributes = {
    pkg: require('./package.json')
};
```

## Requests

Incoming requests are handled by the server via routes. Each route describes an HTTP endpoint with
a path, method, and other properties. The route logic is divided between static configuration,
prerequisite functions and a route handler function. Routes are added via the
[`server.route()`](#serverrouteoptions) method.

### Request lifecycle

Each incoming request passes through a pre-defined list of steps, along with optional
[extensions](#serverextevent-method-options):

- **`'onRequest'`** extension point
    - always called
    - the [request object](#request-object) passed to the extension functions is decorated with the
      [`request.setUrl()`](#requestseturlurl-stripTrailingSlash) and [`request.setMethod()`](#requestsetmethodmethod)
      methods. Calls to these methods will impact how the request is routed and can be used for
      rewrite rules.
    - `request.route` is not yet populated at this point.
    - JSONP configuration is ignored for any response returned from the extension point since no
      route is matched yet and the JSONP configuration is unavailable.
- Lookup route using request path
    - if no route is found or if the path violates the HTTP specification, skips to the
      **`'onPreResponse'`** extension point.
- Process query extensions (e.g. JSONP)
- Parse cookies
- **`'onPreAuth'`** extension point
- Authenticate request
- Read and parse payload
- Authenticate request payload
- **`'onPostAuth'`** extension point
- Validate headers
- Validate path parameters
- Validate query
- Validate payload
- **`'onPreHandler'`** extension point
- [Route prerequisites](#route-prerequisites)
- Route handler
- **`'onPostHandler'`** extension point
    - The response object contained in `request.response` may be modified (but not assigned a new
      value). To return a different response type (for example, replace an error with an HTML
      response), return a new response via `reply(response)`.
- Validate response payload
- **`'onPreResponse'`** extension point
    - always called (except when [`reply.close()`](#replycloseoptions) is called or the client
      terminates the connection prematurely).
    - The response contained in `request.response` may be modified (but not assigned a new value).
      To return a different response type (for example, replace an error with an HTML response),
      return a new response via `reply(response)`. Note that any errors generated after
      `reply(response)` is called will not be passed back to the `'onPreResponse'` extension method
      to prevent an infinite loop.
- Send response (may emit `'request-error'` event)
- Emits `'response'` event
- Wait for tails
- Emits `'tail'` event

### Route configuration

The route configuration object supports the following options:
- `path` - (required) the absolute path used to match incoming requests (must begin with '/').
  Incoming requests are compared to the configured paths based on the connection
  [`router`](#connection.config.router) configuration option. The path can include named parameters
  enclosed in `{}` which  will be matched against literal values in the request as described in
  [Path parameters](#path-parameters).

- `method` - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE',
  or 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'. Use `'*'` to match against any HTTP
  method (only when an exact match was not found, and any match with a specific method will be
  given a higher priority over a wildcard match). Can be assigned an array of methods which has the
  same result as adding the same route with different methods manually.

- `vhost` - an optional domain string or an array of domain strings for limiting the route to only
  requests with a matching host header field. Matching is done against the hostname part of the
  header only (excluding the port). Defaults to all hosts.

- `handler` - (required) the function called to generate the response after successful
  authentication and validation. The handler function is described in
  [Route handler](#route-handler). If set to a string, the value is parsed the same way a
  prerequisite server method string shortcut is processed. Alternatively, `handler` can be assigned
  an object with a single key using the name of a registered handler type and value with the
  options passed to the registered handler.

- `config` - additional [route options](#route-options). The `config` value can be an object
  or a function that returns an object using the signature `function(server)` where `server` is
  the server the route is being added to and `this` is bound to the current realm's `bind` option.

Note that the `options` object is deeply cloned (with the exception of `bind` which is shallowly
copied) and cannot contain any values that are unsafe to perform deep copy on.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

// Handler in top level

const status = function (request, reply) {

    return reply('ok');
};

server.route({ method: 'GET', path: '/status', handler: status });

// Handler in config

const user = {
    cache: { expiresIn: 5000 },
    handler: function (request, reply) {

        return reply({ name: 'John' });
    }
};

server.route({ method: 'GET', path: '/user', config: user });
```

#### Route options

Each route can be customized to change the default behavior of the request lifecycle using the
following options:
- `app` - application-specific request state. Should not be used by [plugins](#plugins) which
  should use `plugins[name]` instead.

- <a name="route.config.auth"></a>`auth` - authentication configuration. Value can be:
    - `false` to disable authentication if a default strategy is set.
    - a string with the name of an authentication strategy registered with
      [`server.auth.strategy()`](#serverauthstrategyname-scheme-mode-options).
    - an object with:
        - `mode` - the authentication mode. Defaults to `'required'` if a server authentication
          strategy is configured, otherwise defaults to no authentication. Available values:
            - `'required'` - authentication is required.
            - `'optional'` - authentication is optional (must be valid if present).
            - `'try'` - same as `'optional'` but allows for invalid authentication.
        - `strategies` - a string array of strategy names in order they should be attempted. If
          only one strategy is used, `strategy` can be used instead with the single string
          value. Defaults to the default authentication strategy which is available only when a
          single strategy is configured.
        - `payload` - if set, the payload (in requests other than 'GET' and 'HEAD') is
          authenticated after it is processed. Requires a strategy with payload authentication
          support (e.g. [Hawk](#https://github.com/hueniverse/hawk)). Cannot be set to a value
          other than `'required'` when the scheme sets the `options.payload` to `true`.
          Available values:
            - `false` - no payload authentication. This is the default value.
            - `'required'` - payload authentication required. This is the default value when
              the scheme sets `options.payload` to `true`.
            - `'optional'` - payload authentication performed only when the client includes
              payload authentication information (e.g. `hash` attribute in Hawk).
        - `access` - an object or array of objects specifying the route access rules. Each
          rule is evaluated against an incoming request and access is granted if at least one
          rule matches. Each rule object must include at least one of:
            - `scope` - the application scope required to access the route. Value can be a scope
              string or an array of scope strings. The authenticated credentials object `scope`
              property must contain at least one of the scopes defined to access the route. If a
              scope string begins with a `+` character, that scope is required. If a scope string
              begins with a `!` character, that scope is forbidden. For example, the scope
              `['!a', '+b', 'c', 'd']` means the incoming request credentials' scope must not include
              'a', must include 'b', and must include one of 'c' or 'd'. You may also access
              properties on the request object (`query` and `params`) to populate a dynamic scope
              by using `{}` characters around the property name, such as `'user-{params.id}'`.
              Defaults to `false` (no scope requirements).
            - `entity` - the required authenticated entity type. If set, must match the `entity`
              value of the authentication credentials. Available values:
                - `any` - the authentication can be on behalf of a user or application. This is the
                  default value.
                - `user` - the authentication must be on behalf of a user which is identified by the
                  presence of a `user` attribute in the `credentials` object returned by the
                  authentication strategy.
                - `app` - the authentication must be on behalf of an application which is identified
                  by the lack of presence of a `user` attribute in the `credentials` object returned
                  by the authentication strategy.

- `bind` - an object passed back to the provided `handler` (via `this`) when called.
  Ignored if the method is an arrow function.

- `cache` - if the route method is 'GET', the route can be configured to include caching
  directives in the response.
  The default `Cache-Control: no-cache` header can be disabled by setting `cache` to `false`.
  Caching can be customized using an object with the following options:
    - `privacy` - determines the privacy flag included in client-side caching using the
      'Cache-Control' header. Values are:
        - `'default'` - no privacy flag. This is the default setting.
        - `'public'` - mark the response as suitable for public caching.
        - `'private'` - mark the response as suitable only for private caching.
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the
      item was saved in the cache. Cannot be used together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'HH:MM' format, at which
      point all cache records for the route expire. Cannot be used together with `expiresIn`.
    - `statuses` - an array of HTTP response status codes (e.g. `200`) which are allowed to include
      a valid caching directive. Defaults to `[200]`.
    - `otherwise` - a string with the value of the 'Cache-Control' header when caching is disabled.
      Defaults to `'no-cache'`.

- `compression` - an object where each key is a content-encoding name and each value is an
  object with the desired encoder settings. Note that decoder settings are set in `payload.compression`.

- `cors` - the [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) protocol allows
  browsers to make cross-origin API calls. CORS is required by web applications running
  inside a browser which are loaded from a different domain than the API server. CORS
  headers are disabled by default (`false`). To enable, set `cors` to `true`, or to an object
  with the following options:
    - `origin` - a strings array of allowed origin servers ('Access-Control-Allow-Origin').
      The array can contain any combination of fully qualified origins along with origin
      strings containing a wildcard `'*'` character, or a single `'*'` origin string. Defaults
      to any origin `['*']`.
    - `maxAge` - number of seconds the browser should cache the CORS response
      ('Access-Control-Max-Age'). The greater the value, the longer it will take before the
      browser checks for changes in policy. Defaults to `86400` (one day).
    - `headers` - a strings array of allowed headers ('Access-Control-Allow-Headers').
      Defaults to `['Accept', 'Authorization', 'Content-Type', 'If-None-Match']`.
    - `additionalHeaders` - a strings array of additional headers to `headers`. Use this to
      keep the default headers in place.
    - `exposedHeaders` - a strings array of exposed headers
      ('Access-Control-Expose-Headers'). Defaults to
      `['WWW-Authenticate', 'Server-Authorization']`.
    - `additionalExposedHeaders` - a strings array of additional headers to
      `exposedHeaders`. Use this to keep the default headers in place.
    - `credentials` - if `true`, allows user credentials to be sent
      ('Access-Control-Allow-Credentials'). Defaults to `false`.

- `ext` - defined a route-level [request extension points](#request-lifecycle) by setting
  the option to an object with a key for each of the desired extension points (`'onRequest'`
  is not allowed), and the value is the same as the [`server.ext(events)`](#serverextevents)
  `event` argument.

- <a name="route.config.files"></a>`files` - defines the behavior for accessing files:
    - `relativeTo` - determines the folder relative paths are resolved against.

- `handler` - an alternative location for the route `handler` option.

- `id` - an optional unique identifier used to look up the route using
  [`server.lookup()`](#serverlookupid). Cannot be assigned to routes with an array of methods.

- `isInternal` - if `true`, the route cannot be accessed through the HTTP connection but only
  through the `server.inject()` interface with the `allowInternals` option set to `true`. Used
  for internal routes that should not be accessible to the outside world. Defaults to `false`.

- `json` - optional arguments passed to `JSON.stringify()` when converting an object or
  error response to a string payload or escaping it after stringification. Supports the following:
    - `replacer` - the replacer function or array. Defaults to no action.
    - `space` - number of spaces to indent nested object keys. Defaults to no indentation.
    - `suffix` - string suffix added after conversion to JSON string. Defaults to no suffix.
    - `escape` - calls [`Hoek.jsonEscape()`](https://github.com/hapijs/hoek/blob/master/API.md#escapejsonstring) after conversion to JSON string. Defaults to `false`.

- `jsonp` - enables JSONP support by setting the value to the query parameter name containing
  the function name used to wrap the response payload. For example, if the value is
  `'callback'`, a request comes in with `'callback=me'`, and the JSON response is
  `'{ "a":"b" }'`, the payload will be `'me({ "a":"b" });'`. Does not work with stream
  responses. Headers `content-type` and `x-content-type-options` are set to
  `text/javascript` and `nosniff` respectively, and will override those
  headers even if explicitly set by `response.type()`

- `log` - if `true`, request level logging is enabled (accessible via [`request.getLog()`](#requestgetlogtags-internal)).

- `payload` - determines how the request payload is processed:
    - `output` - the type of payload representation requested. The value must be one of:
        - `'data'` - the incoming payload is read fully into memory. If `parse` is `true`, the
          payload is parsed (JSON, form-decoded, multipart) based on the 'Content-Type' header.
          If `parse` is false, the raw `Buffer` is returned. This is the default value except
          when a proxy handler is used.
        - `'stream'` - the incoming payload is made available via a `Stream.Readable`
          interface. If the payload is 'multipart/form-data' and `parse` is `true`, fields
          values are presented as text while files are provided as streams. File streams from a
          'multipart/form-data' upload will also have a property `hapi` containing `filename`
          and `headers` properties.
        - `'file'` - the incoming payload is written to temporary file in the directory
          specified by the server's `payload.uploads` settings. If the payload is
          'multipart/form-data' and `parse` is `true`, fields values are presented as text
          while files are saved. Note that it is the sole responsibility of the application to
          clean up the files generated by the framework. This can be done by keeping track
          of which files are used (e.g. using the `request.app` object), and listening to
          the server `'response'` event to perform any needed cleanup.
    - `parse` - can be `true`, `false`, or `gunzip`; determines if the incoming payload is
      processed or presented raw. `true` and `gunzip` includes gunzipping when the appropriate
      'Content-Encoding' is specified on the received request. If parsing is enabled and the
      'Content-Type' is known (for the whole payload as well as parts), the payload is
      converted into an object when possible. If the format is unknown, a Bad Request (400)
      error response is sent. Defaults to `true`, except when a proxy handler is used. The
      supported mime types are:
        - application/json
        - application/x-www-form-urlencoded
        - application/octet-stream
        - text/*
        - multipart/form-data
    - `multipart` - overrides payload processing for multipart requests. Value can be one of:
        - `false` - disables multipart processing.
        - object with the following required options:
            - `output` - same as the `payload.output` option with an additional value option:
                - `annotated` - wraps each multipart part in an object with the following keys:
                    - `headers` - the part headers.
                    - `filename` - the part file name.
                    - `payload` - the processed part payload.
    - `allow` - a string or an array of strings with the allowed mime types for the endpoint.
      Defaults to any of the supported mime types listed above. Note that allowing other mime
      types not listed will not enable them to be parsed, and that if parsing mode is
      `'parse'`, the request will result in an error response.
    - `override` - a mime type string overriding the 'Content-Type' header value received.
      Defaults to no override.
    - `maxBytes` - limits the size of incoming payloads to the specified byte count.
      Allowing very large payloads may cause the server to run out of memory. Defaults to
      `1048576` (1MB).
    - `timeout` - payload reception timeout in milliseconds. Sets the maximum time allowed for the
      client to transmit the request payload (body) before giving up and responding with a Request
      Timeout (408) error response. Set to `false` to disable. Defaults to `10000` (10 seconds).
    - `uploads` - the directory used for writing file uploads. Defaults to `os.tmpdir()`.
    - `failAction` - determines how to handle payload parsing errors. Allowed values are:
        - `'error'` - return a Bad Request (400) error response. This is the default value.
        - `'log'` - report the error but continue processing the request.
        - `'ignore'` - take no action and continue processing the request.
        - a custom error handler function with the signature
          `function(request, reply, error)` where:
            - `request` - the [request object](#request-object).
            - `reply` - the continuation [reply interface](#reply-interface).
            - `error` - the error returned during payload parsing.
    - `defaultContentType` - the default 'Content-Type' HTTP header value is not present.
      Defaults to `'application/json'`.
    - `compression` - an object where each key is a content-encoding name and each value is an
      object with the desired decoder settings. Note that encoder settings are set in the root
      option `compression`.

- `plugins` - plugin-specific configuration. `plugins` is an object where each key is a plugin
  name and the value is the plugin configuration.

- `pre` - an array with [route prerequisites](#route-prerequisites) methods which are executed
  in serial or in parallel before the handler is called.

- `response` - processing rules for the outgoing response:
    - `emptyStatusCode` - the default HTTP status code when the payload is empty. Value can
      be `200` or `204`. Note that a `200` status code is converted to a `204` only at the time
      or response transmission (the response status code will remain `200` throughout the
      request lifecycle unless manually set). Defaults to `200`.
    - `failAction` - defines what to do when a response fails payload validation. Options are:
        - `error` - return an Internal Server Error (500) error response. This is the default
          value.
        - `log` - log the error but send the response.
        - a custom error handler function with the signature
          `function(request, reply, source, error)` where:
            - `request` - the [request object](#request-object).
            - `reply` - the continuation [reply interface](#reply-interface).
            - `source` - a string representing the validation failure source, e.g. 'query', 'payload', 'params', 'headers'.
            - `error` - the error returned from the validation schema.
    - `modify` - if `true`, applies the validation rule changes to the response payload. Defaults to
      `false`.
    - `options` - options to pass to [Joi](http://github.com/hapijs/joi). Useful to set
      global options such as `stripUnknown` or `abortEarly` (the complete list is available
      [here](https://github.com/hapijs/joi/blob/master/API.md#validatevalue-schema-options-callback)).
      If a custom validation function (see `schema` or `status` below) is defined
      then `options` can an arbitrary object that will be passed to this function
      as the second parameter.
      Defaults to no options.
    - `ranges` - if `false`, payload range support is disabled. Defaults to `true`.
    - `sample` - the percent of response payloads validated (0 - 100). Set to `0` to disable all
      validation. Defaults to `100` (all response payloads).
    - `schema` - the default response payload validation rules (for all non-error responses)
      expressed as one of:
        - `true` - any payload allowed (no validation performed). This is the default.
        - `false` - no payload allowed.
        - a [Joi](http://github.com/hapijs/joi) validation object. This will receive the request's
          headers, params, query, payload, app, and auth as context.
        - a validation function using the signature `function(value, options, next)` where:
            - `value` - the value of the response passed to `reply(value)` in the handler.
            - `options` - the server validation options, merged with an object containing the request's
              headers, params, payload, and auth credentials object and isAuthenticated flag.
            - `next([err, [value]])` - the callback function called when validation is completed.  `value` will be used as the response value when `err` is falsy, when `value` is not `undefined`, and when `route.settings.response.modify` is `true`.   If the response is already a `Boom` error it will be set as its `message` value.
    - `status` - HTTP status-code-specific payload validation rules. The `status` key is set to an
      object where each key is a 3 digit HTTP status code and the value has the same
      definition as `schema`. If a response status code is not present in the `status` object,
      the `schema` definition is used, except for errors which are not validated by default.

- `security` - sets common security headers (disabled by default). To enable set `security` to
  `true` or to an object with the following options:
    - `hsts` - controls the 'Strict-Transport-Security' header. If set to `true` the header
      will be set to `max-age=15768000`, if specified as a number the maxAge parameter will
      be set to that number. Defaults to `true`. You may also specify an object with the
      following fields:
        - `maxAge` - the max-age portion of the header, as a number. Default is `15768000`.
        - `includeSubDomains` - a boolean specifying whether to add the `includeSubDomains`
          flag to the header.
        - `preload` - a boolean specifying whether to add the 'preload' flag (used to submit
          domains inclusion in Chrome's HTTP Strict Transport Security (HSTS) preload list)
          to the header.
    - `xframe` - controls the 'X-Frame-Options' header. When set to `true` the header will
      be set to `DENY`, you may also specify a string value of 'deny' or 'sameorigin'. Defaults to `true`. To
      use the 'allow-from' rule, you must set this to an object with the following fields:
        - `rule` - either 'deny', 'sameorigin', or 'allow-from'
        - `source` - when `rule` is 'allow-from' this is used to form the rest of the
          header, otherwise this field is ignored. If `rule` is 'allow-from' but `source`
          is unset, the rule will be automatically changed to 'sameorigin'.
    - `xss` - boolean that controls the 'X-XSS-PROTECTION' header for IE. Defaults to
      `true` which sets the header to equal '1; mode=block'. NOTE: This setting can create
      a security vulnerability in versions of IE below 8, as well as unpatched versions of
      IE8. See [here](http://hackademix.net/2009/11/21/ies-xss-filter-creates-xss-vulnerabilities/)
      and [here](https://technet.microsoft.com/library/security/ms10-002) for more
      information. If you actively support old versions of IE, it may be wise to explicitly
      set this flag to `false`.
    - `noOpen` - boolean controlling the 'X-Download-Options' header for IE, preventing
      downloads from executing in your context. Defaults to `true` setting the header to
      'noopen'.
    - `noSniff` - boolean controlling the 'X-Content-Type-Options' header. Defaults to
      `true` setting the header to its only and default option, 'nosniff'.

- <a name="route.config.state"></a>`state` - HTTP state management (cookies) allows
  the server to store information on the client which is sent back to the server with every
  request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)). `state` supports
  the following options:
    - `parse` - determines if incoming 'Cookie' headers are parsed and stored in the
      `request.state` object. Defaults to `true`.
    - `failAction` - determines how to handle cookie parsing errors. Allowed values are:
        - `'error'` - return a Bad Request (400) error response. This is the default value.
        - `'log'` - report the error but continue processing the request.
        - `'ignore'` - take no action.

- `validate` - request input validation rules for various request components. When using a
  [Joi](http://github.com/hapijs/joi) validation object, the values of the other inputs (i.e.
  `headers`, `query`, `params`, `payload`, `app`, and `auth`) are made available under the validation
  context (accessible in rules as `Joi.ref('$query.key')`). Note that validation is performed in
  order (i.e. headers, params, query, payload) and if type casting is used (converting a string to
  number), the value of inputs not yet validated will reflect the raw, unvalidated and unmodified
  values. If the validation rules for `headers`, `params`, `query`, and `payload` are defined
  at both the routes defaults level and an individual route, the individual route settings override
  the routes defaults (the rules are not merged). The `validate` object supports:

    - `headers` - validation rules for incoming request headers (note that all header field names
      must be in lowercase to match the headers normalized by node). Values allowed:
        - `true` - any headers allowed (no validation performed).  This is the default.
        - `false` - no headers allowed (this will cause all valid HTTP requests to fail).
        - a [Joi](http://github.com/hapijs/joi) validation object.
        - a validation function using the signature `function(value, options, next)` where:
            - `value` - the object containing the request headers.
            - `options` - the server validation options.
            - `next([err, [value]])` - the callback function called when validation is completed.  `value` will be used as the `headers` value when `err` is falsy.  If `next` is called with `undefined` or no arguments then the original value of `value` will be used.

    - `params` - validation rules for incoming request path parameters, after matching the path
      against the route and extracting any parameters then stored in `request.params`. Values
      allowed:
        - `true` - any path parameters allowed (no validation performed).  This is the default.
        - `false` - no path variables allowed.
        - a [Joi](http://github.com/hapijs/joi) validation object.
        - a validation function using the signature `function(value, options, next)` where:
            - `value` - the object containing the path parameters.
            - `options` - the server validation options.
            - `next([err, [value]])` - the callback function called when validation is completed.  `value` will be used as the `params` value when `err` is falsy.  If `next` is called with `undefined` or no arguments then the original value of `value` will be used.

    - `query` - validation rules for an incoming request URI query component (the key-value
      part of the URI between '?' and '#'). The query is parsed into its individual key-value
      pairs and stored in `request.query` prior to validation. Values allowed:
        - `true` - any query parameters allowed (no validation performed). This is the default.
        - `false` - no query parameters allowed.
        - a [Joi](http://github.com/hapijs/joi) validation object.
        - a validation function using the signature `function(value, options, next)` where:
            - `value` - the object containing the query parameters.
            - `options` - the server validation options.
            - `next([err, [value]])` - the callback function called when validation is completed.  `value` will be used as the `query` value when `err` is falsy.  If `next` is called with `undefined` or no arguments then the original value of `value` will be used.

    - `payload` - validation rules for an incoming request payload (request body). Values
      allowed:
        - `true` - any payload allowed (no validation performed). This is the default.
        - `false` - no payload allowed.
        - a [Joi](http://github.com/hapijs/joi) validation object. Note that empty payloads
          are represented by a `null` value. If a validation schema is provided and empty
          payload are supported, it must be explicitly defined by setting the `payload` value
          to a **joi** schema with `null` allowed (e.g. `Joi.object({ /* keys here */ }).allow(null)`).
        - a validation function using the signature `function(value, options, next)` where:
            - `value` - the object containing the payload object.
            - `options` - the server validation options.
            - `next([err, [value]])` - the callback function called when validation is completed.  `value` will be used as the `payload` value when `err` is falsy.  If `next` is called with `undefined` or no arguments then the original value of `value` will be used.

    - `errorFields` - an optional object with error fields copied into every validation error
      response.

    - `failAction` - determines how to handle invalid requests. Allowed values are:
        - `'error'` - return a Bad Request (400) error response. This is the default value.
        - `'log'` - log the error but continue processing the request.
        - `'ignore'` - take no action.
        - a custom error handler function with the signature
          `function(request, reply, source, error)` where:
            - `request` - the [request object](#request-object).
            - `reply` - the continuation [reply interface](#reply-interface).
            - `source` - the source of the invalid field (e.g. `'headers'`, `'params'`, `'query'`,
              `'payload'`).
            - `error` - the error object prepared for the client response (including the
              validation function error under `error.data`).

    - `options` - options to pass to [Joi](http://github.com/hapijs/joi). Useful to set
      global options such as `stripUnknown` or `abortEarly` (the complete list is available
      [here](https://github.com/hapijs/joi/blob/master/API.md#validatevalue-schema-options-callback)).
      If a custom validation function (see `headers`, `params`, `query`, or `payload`
      above) is defined then `options` can an arbitrary object that will be passed
      to this function as the second parameter.
      Defaults to no options.

- `timeout` - define timeouts for processing durations:
    - `server` - response timeout in milliseconds. Sets the maximum time allowed for the
      server to respond to an incoming client request before giving up and responding with
      a Service Unavailable (503) error response. Disabled by default (`false`).
    - `socket` - by default, node sockets automatically timeout after 2 minutes. Use this
      option to override this behavior. Defaults to `undefined` which leaves the node
      default unchanged. Set to `false` to disable socket timeouts.

The following documentation options are also available when adding new routes (they are not
available when setting defaults):
- `description` - route description used for generating documentation (string).
- `notes` - route notes used for generating documentation (string or array of strings).
- `tags` - route tags used for generating documentation (array of strings).

#### Route public interface

When route information is returned or made available as a property, it is an object with the
following:
- `method` - the route HTTP method.
- `path` - the route path.
- `vhost` - the route vhost option if configured.
- `realm` - the [active realm](#serverrealm) associated with the route.
- `settings` - the [route options](#route-options) object with all defaults applied.
- `fingerprint` - the route internal normalized string representing the normalized path.
- `auth` - route authentication utilities:
    - `access(request)` - authenticates the passed `request` argument against the route's
      authentication `access` configuration. Returns `true` if the `request` would have passed
      the route's access requirements. Note that the route's authentication mode and strategies
      are ignored. The only match is made between the `request.auth.credentials` scope
      and entity information and the route `access` configuration. Also, if the route uses
      dynamic scopes, the scopes are constructed against the `request.query` and `request.params`
      which may or may not match between the route and the request's route. If this method is
      called using a request that has not been authenticated (yet or at all), it will return
      `false` if the route requires any authentication.

### Path parameters

Parameterized paths are processed by matching the named parameters to the content of the incoming
request path at that path segment. For example, '/book/{id}/cover' will match '/book/123/cover' and
`request.params.id` will be set to `'123'`. Each path segment (everything between the opening '/'
and the closing '/' unless it is the end of the path) can only include one named parameter. A
parameter can cover the entire segment ('/{param}') or part of the segment ('/file.{ext}').  A path
parameter may only contain letters, numbers and underscores, e.g. '/{file-name}' is invalid
and '/{file_name}' is valid.

An optional '?' suffix following the parameter name indicates an optional parameter (only allowed
if the parameter is at the ends of the path or only covers part of the segment as in
'/a{param?}/b'). For example, the route '/book/{id?}' matches '/book/' with the value of
`request.params.id` set to an empty string `''`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const getAlbum = function (request, reply) {

    return reply('You asked for ' +
        (request.params.song ? request.params.song + ' from ' : '') +
        request.params.album);
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
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const getPerson = function (request, reply) {

    const nameParts = request.params.name.split('/');
    return reply({ first: nameParts[0], last: nameParts[1] });
};

server.route({
    path: '/person/{name*2}',   // Matches '/person/john/doe'
    method: 'GET',
    handler: getPerson
});
```

### Path matching order

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
catch-all route for a specific method or all methods. Only one catch-all route can be defined per
server connection.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const handler = function (request, reply) {

    return reply('The page was not found').code(404);
};

server.route({ method: '*', path: '/{p*}', handler: handler });
```

### Route handler

The route handler function uses the signature `function(request, reply)` (NOTE: do *not* use a fat arrow style function for route handlers as they do not allow context binding and will cause problems when used in conjunction with [server.bind](#server-bind)) where:
- `request` - is the incoming [request object](#request-object) (this is not the node.js request
  object).
- `reply` - the [reply interface](#reply-interface) the handler must call to set a response and
  return control back to the framework.

```js
const handler = function (request, reply) {

    return reply('success');
};
```

If the handler returns a Promise then Hapi will register a `catch` handler on the promise object to catch unhandled promise rejections. The handler will `reply` with the rejected value, wrapped in a [`Boom`](https://github.com/hapijs/boom) error:

```js
const handler = function (request, reply) {

    const badPromise = () => {

        new Promise((resolve, reject) => {

            // Hapi catches this...
            throw new Error();

            // ...and this...
            return reject(new Error());
        }
    }

    // ...if you don't provide a 'catch'. The rejection will be wrapped in a Boom error.
    return badPromise().then(reply);
}
```

This provides a safety net for unhandled promise rejections.

### Route prerequisites

It is often necessary to perform prerequisite actions before the handler is called (e.g. load
required reference data from a database). The route `pre` option allows defining such pre-handler
methods. The methods are called in order. If the `pre` array contains another array, those methods
are called in parallel. `pre` can be assigned a mixed array of:
- arrays containing the elements listed below, which are executed in parallel.
- objects with:
    - `method` - the function to call (or short-hand method string as described below). the
      function signature is identical to a route handler as described in
      [Route handler](#route-handler).
    - `assign` - key name to assign the result of the function to within `request.pre`.
    - `failAction` - determines how to handle errors returned by the method. Allowed values are:
        - `'error'` - returns the error response back to the client. This is the default value.
        - `'log'` - logs the error but continues processing the request. If `assign` is used, the
          error will be assigned.
        - `'ignore'` - takes no special action. If `assign` is used, the error will be assigned.
- functions - same as including an object with a single `method` key.
- strings - special short-hand notation for registered
  [server methods](#servermethodname-method-options) using the format 'name(args)' (e.g.
  `'user(params.id)'`) where:
    - 'name' - the method name. The name is also used as the default value of `assign`.
    - 'args' - the method arguments (excluding `next`) where each argument is a property of
      the [request object](#request-object).

Note that prerequisites do not follow the same rules of the normal
[reply interface](#reply-interface). In all other cases, calling `reply()` with or without a value
will use the result as the response sent back to the client. In a prerequisite method, calling
`reply()` will assign the returned value to the provided `assign` key. If the returned value is an
error, the `failAction` setting determines the behavior. To force the return value as the response
and skip any other prerequisites and the handler, use the `reply().takeover()` method.

The reason for the difference in the reply interface behavior is to allow reusing handlers and
prerequisites methods interchangeably. By default, the desired behavior for a prerequisite is to
retain the result value and pass it on to the next step. Errors end the lifecycle by default. While
less consistent, this allows easier code reusability.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const pre1 = function (request, reply) {

    return reply('Hello');
};

const pre2 = function (request, reply) {

    return reply('World');
};

const pre3 = function (request, reply) {

    return reply(request.pre.m1 + ' ' + request.pre.m2);
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

            return reply(request.pre.m3 + '\n');
        }
    }
});
```

### Request object

The request object is created internally for each incoming request. It is **different** from the
node.js request object received from the HTTP server callback (which is available in
`request.raw.req`). The request object methods and properties change throughout the
[request lifecycle](#request-lifecycle).

#### Request properties

Each request object includes the following properties:

- `app` - application-specific state. Provides a safe place to store application data without
  potential conflicts with the framework. Should not be used by [plugins](#plugins) which should use
  `plugins[name]`.
- `auth` - authentication information:
    - `isAuthenticated` - `true` if the request has been successfully authenticated, otherwise
      `false`.
    - `credentials` - the `credential` object received during the authentication process. The
      presence of an object does not mean successful authentication.
    - `artifacts` - an artifact object received from the authentication strategy and used in
      authentication-related actions.
    - `mode` - the route authentication mode.
    - `error` - the authentication error is failed and mode set to `'try'`.
- `connection` - the connection the request was received by.
- `domain` - the [node domain object](https://nodejs.org/api/domain.html#domain_domain) used to protect against exceptions thrown in extensions,
  handlers and [route prerequisites](#route-prerequisites). Can be used to manually bind callback
  functions otherwise bound to other domains. Set to `null` when the server `useDomains` options is
  `false`.
- `headers` - the raw request headers (references `request.raw.headers`).
- `id` - a unique request identifier (using the format '{now}:{connection.info.id}:{5 digits counter}').
- `info` - request information:
    - `acceptEncoding` - the request preferred encoding.
    - `cors` - if CORS is enabled for the route, contains the following:
        - `isOriginMatch` - `true` if the request 'Origin' header matches the configured CORS
          restrictions. Set to `false` if no 'Origin' header is found or if it does not match.
          Note that this is only available after the `'onRequest'` extension point as CORS is
          configured per-route and no routing decisions are made at that point in the request
          lifecycle.
    - `host` - content of the HTTP 'Host' header (e.g. 'example.com:8080').
    - `hostname` - the hostname part of the 'Host' header (e.g. 'example.com').
    - `received` - request reception timestamp.
    - `referrer` - content of the HTTP 'Referrer' (or 'Referer') header.
    - `remoteAddress` - remote client IP address.
    - `remotePort` - remote client port.
    - `responded` - request response timestamp (`0` is not responded yet).
- `method` - the request method in lower case (e.g. `'get'`, `'post'`).
- `mime` - the parsed content-type header. Only available when payload parsing enabled and no
  payload error occurred.
- `orig` - an object containing the values of `params`, `query`, and `payload` before any
  validation modifications made. Only set when input validation is performed.
- `params` - an object where each key is a path parameter name with matching value as described in
  [Path parameters](#path-parameters).
- `paramsArray` - an array containing all the path `params` values in the order they appeared in
  the path.
- `path` - the request URI's [pathname](https://nodejs.org/api/url.html#url_urlobject_pathname) component.
- `payload` - the request payload based on the route `payload.output` and `payload.parse` settings.
- `plugins` - plugin-specific state. Provides a place to store and pass request-level plugin data.
  The `plugins` is an object where each key is a plugin name and the value is the state.
- `pre` - an object where each key is the name assigned by a
  [route prerequisites](#route-prerequisites) function. The values are the raw values provided to
  the continuation function as argument. For the wrapped response object, use `responses`.
- `response` - the response object when set. The object can be modified but must not be assigned
  another object. To replace the response with another from within an
  [extension point](#serverextevent-method-options), use `reply(response)` to override with a
  different response. Contains `null` when no response has been set (e.g. when a request terminates
  prematurely when the client disconnects).
- `preResponses` - same as `pre` but represented as the response object created by the pre method.
- `query` - by default the object outputted from [node's URL parse()](https://nodejs.org/docs/latest/api/url.html#url_urlobject_query) method.  Might also be set indirectly via [request.setUrl](#requestseturlurl-striptrailingslash) in which case it may be a `string` (if `url` is set to an object with the `query` attribute as an unparsed string).
- `raw` - an object containing the Node HTTP server objects. **Direct interaction with these raw
  objects is not recommended.**
    - `req` - the node.js request object.
    - `res` - the node.js response object.
- `route` - the [route public interface](#route-public-interface).
- `server` - the server object.
- `state` - an object containing parsed HTTP state information (cookies) where each key is the
  cookie name and value is the matching cookie content after processing using any registered cookie
  definition.
- `url` - the parsed request URI.

#### `request.setUrl(url, [stripTrailingSlash]`

_Available only in `'onRequest'` extension methods._

Changes the request URI before the router begins processing the request where:
 - `url` - the new request URI. If `url` is a string, it is parsed with [node's **URL**
 `parse()`](https://nodejs.org/docs/latest/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
 method with `parseQueryString` set to `true`.  `url` can also be set to an object
 compatible with node's **URL** `parse()` method output.
 - `stripTrailingSlash` - if `true`, strip the trailing slash from the path. Defaults to `false`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const onRequest = function (request, reply) {

    // Change all requests to '/test'
    request.setUrl('/test');
    return reply.continue();
};

server.ext('onRequest', onRequest);
```

To use another query string parser:

```js
const Url = require('url');
const Hapi = require('hapi');
const Qs = require('qs');

const server = new Hapi.Server();
server.connection({ port: 80 });

const onRequest = function (request, reply) {

    const uri = request.url.href;
    const parsed = Url.parse(uri, false);
    parsed.query = Qs.parse(parsed.query);
    request.setUrl(parsed);

    return reply.continue();
};

server.ext('onRequest', onRequest);
```


#### `request.setMethod(method)`

_Available only in `'onRequest'` extension methods._

Changes the request method before the router begins processing the request where:
- `method` - is the request HTTP method (e.g. `'GET'`).

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const onRequest = function (request, reply) {

    // Change all requests to 'GET'
    request.setMethod('GET');
    return reply.continue();
};

server.ext('onRequest', onRequest);
```

#### `request.generateResponse(source, [options])`

_Always available._

Returns a [`response`](#response-object) which you can pass into the [reply interface](#reply-interface) where:
- `source` - the value to set as the source of the [reply interface](#reply-interface), optional.
- `options` - options for the method, optional.

For example it can be used inside a promise to create a response object which has a non-error code to resolve with the [reply interface](#reply-interface):

```js
const handler = function (request, reply) {

    const result = promiseMethod().then((thing) => {

        if (!thing) {
            return request.generateResponse().code(214);
        }
        return thing;
    });
    return reply(result);
};
```

#### `request.log(tags, [data, [timestamp]])`

_Always available._

Logs request-specific events. When called, the server emits a `'request'` event which can be used
by other listeners or [plugins](#plugins). The arguments are:
- `tags` - a string or an array of strings (e.g. `['error', 'database', 'read']`) used to identify
  the event. Tags are used instead of log levels and provide a much more expressive mechanism for
  describing and filtering events.
- `data` - an optional message string or object with the application data being logged. If `data`
  is a function, the function signature is `function()` and it called once to generate (return
  value) the actual data emitted to the listeners.
- `timestamp` - an optional timestamp expressed in milliseconds. Defaults to `Date.now()` (now).

Any logs generated by the server internally will be emitted only on the `'request-internal'`
channel and will include the `event.internal` flag set to `true`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80, routes: { log: true } });

server.on('request', (request, event, tags) => {

    if (tags.error) {
        console.log(event);
    }
});

const handler = function (request, reply) {

    request.log(['test', 'error'], 'Test event');
    return reply();
};
```

#### `request.getLog([tags], [internal])`

_Always available._

Returns an array containing the events matching any of the tags specified (logical OR) where:
- `tags` - is a single tag string or array of tag strings. If no `tags` specified, returns all
  events.
- `internal` - filters the events to only those with a matching `event.internal` value. If `true`,
  only internal logs are included. If `false`, only user event are included. Defaults to all events
  (`undefined`).

Note that this methods requires the route `log` configuration set to `true`.

```js
request.getLog();
request.getLog('error');
request.getLog(['error', 'auth']);
request.getLog(['error'], true);
request.getLog(false);
```

#### `request.tail([name])`

_Available until immediately after the `'response'` event is emitted._

Adds a request tail which has to complete before the [request lifecycle](#request-lifecycle) is
complete where:
- `name` - an optional tail name used for logging purposes.

Returns a tail function which must be called when the tail activity is completed.

Tails are actions performed throughout the [request lifecycle](#request-lifecycle), but which may
end after a response is sent back to the client. For example, a request may trigger a database
update which should not delay sending back a response. However, it is still desirable to associate
the activity with the request when logging it (or an error associated with it).

When all tails completed, the server emits a `'tail'` event.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const get = function (request, reply) {

    const dbTail = request.tail('write to database');

    db.save('key', 'value', () => {

        dbTail();
    });

    return reply('Success!');
};

server.route({ method: 'GET', path: '/', handler: get });

server.on('tail', (request) => {

    console.log('Request completed including db activity');
});
```

#### Request events

The [request object](#request-object) supports the following events:

- `'peek'` - emitted for each chunk of payload data read from the client connection. The event
  method signature is `function(chunk, encoding)`.
- `'finish'` - emitted when the request payload finished reading. The event method signature is
  `function ()`.
- `'disconnect'` - emitted when a request errors or aborts unexpectedly.

```js
const Crypto = require('crypto');
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const onRequest = function (request, reply) {

    const hash = Crypto.createHash('sha1');
    request.on('peek', (chunk) => {

        hash.update(chunk);
    });

    request.once('finish', () => {

        console.log(hash.digest('hex'));
    });

    request.once('disconnect', () => {

        console.error('request aborted');
    });

    return reply.continue();
};

server.ext('onRequest', onRequest);
```

## Reply interface

The various [request lifecycle](#request-lifecycle) events (e.g. extensions, authentication,
[route prerequisites](#route-prerequisites), handlers) provide a reply interface as one of the
function arguments. The reply interface acts as both a callback interface to return control to the
framework and a response generator.

When `reply()` is called with an error or result response, that value is used as the response sent
to the client. When `reply()` is called within a prerequisite, the value is saved for future use
and is not used as the response. In all other places except for the handler, calling `reply()` will
be considered an error and will abort the [request lifecycle](#request-lifecycle), jumping directly
to the `'onPreResponse'` event.

To return control to the framework within an [extension](#serverextevent-method-options) or other
places other than the handler, without setting a response, the method
[`reply.continue()`](#replycontinueresult) must be called. Except when used within an authentication
strategy, or in an `'onPostHandler'` or `'onPreResponse'` extension, the `reply.continue()` must
not be passed any argument or an exception is thrown.

### `reply([err], [result])`

Concludes the handler activity by setting a response and returning control over to the framework
where:
- `err` - an optional error response.
- `result` - an optional response payload.

Since a request can only have one response regardless if it is an error or success, the `reply()`
method can only result in a single response value. This means that passing both an `err` and
`result` will only use the `err`. There is no requirement for either `err` or `result` to be (or
not) an `Error` object. The framework will simply use the first argument if present, otherwise the
second. The method supports two arguments to be compatible with the common callback pattern of
error first. If a third argument is passed, an exception is thrown.

Both `err` and `result` can be set to:
- `null`
- `undefined`
- string
- number
- boolean
- `Buffer` object
- `Error` object
- `Stream` object (**Note** - any `Stream` object must be compatible with the "streams2" API and not be in `objectMode`)
- Promise object
- any other object or array

```js
const handler = function (request, reply) {

    return reply('success');
};
```

If the input is not an `Error` object, the method returns a [`response`](#response-object) object
which provides a set of methods to customize the response (e.g. HTTP status code, custom headers,
etc.). If the input is an `Error` object, the method returns back the error wrapped in a
[`Boom`](https://github.com/hapijs/boom) object.

Note that when used to return both an error and credentials in the authentication methods,
`reply()` must be called with three arguments `function(err, null, data)` where `data` is the
additional authentication information. This is the only time where a third argument is allowed
(and required).

The [response flow control rules](#flow-control) apply.

```js
// Detailed notation

const handler = function (request, reply) {

    const response = reply('success');
    response.type('text/plain');
    response.header('X-Custom', 'some-value');
};

// Chained notation

const handler = function (request, reply) {

    return reply('success')
        .type('text/plain')
        .header('X-Custom', 'some-value');
};
```

Note that if `result` is a `Stream` with a `statusCode` property, that status code will be used as
the default response code.

Any value provided to `reply()` (including no value) will be used as the response sent back to the
client. This means calling `reply()` with a value in an
[extension methods](#serverextevent-method-options) or authentication function will be considered
an error and will terminate the [request lifecycle](#request-lifecycle). With the exception of the
handler function, all other methods provide the `reply.continue()` method which instructs the
framework to continue processing the request without setting a response.

The `reply` object includes the following properties:
- `realm` - the [active realm](#serverrealm) associated with the route.
- `request` - the [request object](#request-object).

#### Response object

Every response includes the following properties:
- `statusCode` - the HTTP response status code. Defaults to `200` (except for errors).
- `headers` - an object containing the response headers where each key is a header field name. Note
  that this is an incomplete list of headers to be included with the response. Additional headers
  will be added once the response is prepared for transmission.
- `source` - the value provided using the [reply interface](#reply-interface).
- `variety` - a string indicating the type of `source` with available values:
    - `'plain'` - a plain response such as string, number, `null`, or simple object (e.g. not a
      `Stream`, `Buffer`, or view).
    - `'buffer'` - a `Buffer`.
    - `'stream'` - a `Stream`.
    - `'promise'` - a Promise object.
- `app` - application-specific state. Provides a safe place to store application data without
  potential conflicts with the framework. Should not be used by [plugins](#plugins) which should
  use `plugins[name]`.
- `plugins` - plugin-specific state. Provides a place to store and pass request-level plugin data.
  The `plugins` is an object where each key is a plugin name and the value is the state.
- `settings` - response handling flags:
    - `charset` -  the 'Content-Type' HTTP header 'charset' property. Defaults to `'utf-8'`.
    - `encoding` - the string encoding scheme used to serial data into the HTTP payload when
      `source` is a string or marshals into a string.
      Defaults to `'utf8'`.
    - `passThrough` - if `true` and `source` is a `Stream`, copies the `statusCode` and `headers`
      of the stream to the outbound response. Defaults to `true`.
    - `stringify` - options used for `source` value requiring stringification. Defaults to no
      replacer and no space padding.
    - `ttl` -  if set, overrides the route cache expiration milliseconds value set in the route
      config. Defaults to no override.
    - `varyEtag` - if `true`, a suffix will be automatically added to the 'ETag' header at
      transmission time (separated by a `'-'` character) when the HTTP 'Vary' header is present.

Response objects also includes the `isBoom`, and optional `isMissing` properties
from **boom** error objects.

The response object provides the following methods:
- `bytes(length)` - sets the HTTP 'Content-Length' header (to avoid chunked transfer encoding)
  where:
    - `length` - the header value. Must match the actual payload size.
- `charset(charset)` - sets the 'Content-Type' HTTP header 'charset' property where:
    `charset` - the charset property value.
- `code(statusCode)` - sets the HTTP status code where:
    - `statusCode` - the HTTP status code (e.g. 200).
- `message(httpMessage)` - sets the HTTP status message where:
    - `httpMessage` - the HTTP status message (e.g. 'Ok' for status code 200).
- `created(uri)` - sets the HTTP status code to Created (201) and the HTTP 'Location' header where:
    `uri` - an absolute or relative URI used as the 'Location' header value.
- `encoding(encoding)` - sets the string encoding scheme used to serial data into the HTTP payload
  where:
    `encoding` - the encoding property value (see
      [node Buffer encoding](http://nodejs.org/api/buffer.html#buffer_buffer)).
- `etag(tag, options)` - sets the representation
   [entity tag](http://tools.ietf.org/html/rfc7232#section-2.3) where:
    - `tag` - the entity tag string without the double-quote.
    - `options` - optional settings where:
        - `weak` - if `true`, the tag will be prefixed with the `'W/'` weak signifier. Weak tags
          will fail to match identical tags for the purpose of determining 304 response status.
          Defaults to `false`.
        - `vary` - if `true` and content encoding is set or applied to the response (e.g 'gzip' or
          'deflate'), the encoding name will be automatically added to the tag at transmission time
          (separated by a `'-'` character). Ignored when `weak` is `true`. Defaults to `true`.
- `header(name, value, options)` - sets an HTTP header where:
    - `name` - the header name.
    - `value` - the header value.
    - `options` - optional settings where:
        - `append` - if `true`, the value is appended to any existing header value using
          `separator`. Defaults to `false`.
        - `separator` - string used as separator when appending to an existing value. Defaults to
          `','`.
        - `override` - if `false`, the header value is not set if an existing value present.
          Defaults to `true`.
        - `duplicate` - if `false`, the header value is not modified if the provided value is
          already included. Does not apply when `append` is `false` or if the `name` is
          `'set-cookie'`. Defaults to `true`.
- `location(uri)` - sets the HTTP 'Location' header where:
    - `uri` - an absolute or relative URI used as the 'Location' header value.
- `redirect(uri)` - sets an HTTP redirection response (302) and decorates the response with
  additional methods listed below, where:
    - `uri` - an absolute or relative URI used to redirect the client to another resource.
- `replacer(method)` - sets the `JSON.stringify()` `replacer` argument where:
    - `method` - the replacer function or array. Defaults to none.
- `spaces(count)` - sets the `JSON.stringify()` `space` argument where:
    - `count` - the number of spaces to indent nested object keys. Defaults to no indentation.
- `state(name, value, [options])` - sets an HTTP cookie where:
    - `name` - the cookie name.
    - `value` - the cookie value. If no `encoding` is defined, must be a string. See
      [`server.state()`](#serverstatename-options) for supported `encoding` values.
    - `options` - optional configuration. If the state was previously registered with the server
      using [`server.state()`](#serverstatename-options),
      the specified keys in `options` override those same keys in the server definition (but not
      others).
- `suffix(suffix)` - sets a string suffix when the response is process via `JSON.stringify()`.
- `ttl(msec)` - overrides the default route cache expiration rule for this response instance where:
    - `msec` - the time-to-live value in milliseconds.
- `type(mimeType)` - sets the HTTP 'Content-Type' header where:
    - `value` - is the mime type. Should only be used to override the built-in default for each
      response type.
- `unstate(name, [options])` - clears the HTTP cookie by setting an expired value where:
    - `name` - the cookie name.
    - `options` - optional configuration for expiring cookie. If the state was previously
      registered with the server using [`server.state()`](#serverstatename-options), the specified
      keys in `options` override those same keys in the server definition (but not others).
- `vary(header)` - adds the provided header to the list of inputs affected the response generation
  via the HTTP 'Vary' header where:
    - `header` - the HTTP request header name.
- `hold()` - see [flow control](#flow-control).
- `send()` - see [flow control](#flow-control).
- `takeover()` - see [route prerequisites](#route-prerequisites).

##### Response Object Redirect Methods

When using the `redirect()` method, the response object provides these additional methods:

- `temporary(isTemporary)` - sets the status code to `302` or `307` (based on the `rewritable()`
  setting) where:
    - `isTemporary` - if `false`, sets status to permanent. Defaults to `true`.
- `permanent(isPermanent)` - sets the status code to `301` or `308` (based on the `rewritable()`
  setting) where:
    - `isPermanent` - if `false`, sets status to temporary. Defaults to `true`.
- `rewritable(isRewritable)` - sets the status code to `301`/`302` for rewritable (allows changing
  the request method from 'POST' to 'GET') or `307`/`308` for non-rewritable (does not allow
  changing the request method from 'POST' to 'GET'). Exact code based on the `temporary()` or
  `permanent()` setting. Arguments:
    - `isRewritable` - if `false`, sets to non-rewritable. Defaults to `true`.

|                |  Permanent | Temporary |
| -------------- | ---------- | --------- |
| Rewritable     | 301        | **302**(1)|
| Non-rewritable | 308(2)     | 307       |

Notes:
1. Default value.
2. [Proposed code](http://tools.ietf.org/id/draft-reschke-http-status-308-07.txt), not supported by
  all clients.

##### Response events

The response object supports the following events:

- `'peek'` - emitted for each chunk of data written back to the client connection. The event method
  signature is `function(chunk, encoding)`.
- `'finish'` - emitted when the response finished writing but before the client response connection
  is ended. The event method signature is `function ()`.

```js
const Crypto = require('crypto');
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const preResponse = function (request, reply) {

    const response = request.response;
    if (response.isBoom) {
        return reply();
    }

    const hash = Crypto.createHash('sha1');
    response.on('peek', (chunk) => {

        hash.update(chunk);
    });

    response.once('finish', () => {

        console.log(hash.digest('hex'));
    });

    return reply.continue();
};

server.ext('onPreResponse', preResponse);
```

#### Error response

**hapi** uses the [**boom**](https://github.com/hapijs/boom) error library for all its internal
error generation. **boom** provides an expressive interface to return HTTP errors. Any error
returned via the [reply interface](#reply-interface) is converted to a **boom** object and defaults
to status code `500` if the error is not a **boom** object.

When the error is sent back to the client, the response contains a JSON object with the
`statusCode`, `error`, and `message` keys.

```js
const Hapi = require('hapi');
const Boom = require('boom');

const server = new Hapi.Server();

server.route({
    method: 'GET',
    path: '/badRequest',
    handler: function (request, reply) {

        return reply(Boom.badRequest('Unsupported parameter'));
    }
});

server.route({
    method: 'GET',
    path: '/internal',
    handler: function (request, reply) {

        return reply(new Error('unexpect error'));
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
    - `payload` - the formatted object used as the response payload (stringified). Can be directly
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
const Boom = require('boom');

const handler = function (request, reply) {

    const error = Boom.badRequest('Cannot feed after midnight');
    error.output.statusCode = 499;    // Assign a custom error code
    error.reformat();

    error.output.payload.custom = 'abc_123'; // Add custom key

    return reply(error);
});
```

When a different error representation is desired, such as an HTML page or a different payload
format, the `'onPreResponse'` extension point may be used to identify errors and replace them with
a different response object.

```js
const Hapi = require('hapi');
const Vision = require('vision');
const server = new Hapi.Server();
server.register(Vision, (err) => {
    server.views({
        engines: {
            html: require('handlebars')
        }
  });
});
server.connection({ port: 80 });

const preResponse = function (request, reply) {

    const response = request.response;
    if (!response.isBoom) {
        return reply.continue();
    }

    // Replace error with friendly HTML

      const error = response;
      const ctx = {
          message: (error.output.statusCode === 404 ? 'page not found' : 'something went wrong')
      };

      return reply.view('error', ctx).code(error.output.statusCode);
};

server.ext('onPreResponse', preResponse);
```

#### Flow control

When calling `reply()`, the framework waits until `process.nextTick()` to continue processing the
request and transmit the response. This enables making changes to the returned
[response object](#response-object) before the response is sent. This means the framework
will resume as soon as the handler method exits. To suspend this behavior, the returned
`response` object supports the following methods:
- `hold()` - puts the response on hold until `response.send()` is called. Available only after
  `reply()` is called and until `response.hold()` is invoked once.
- `send()` - immediately resume the response. Available only after
  `response.hold()` is called and until `response.send()` is invoked once.

```js
const handler = function (request, reply) {

    const response = reply('success').hold();

    setTimeout(() => {

        response.send();
    }, 1000);
};
```

### `reply.continue([result])`

Returns control back to the framework without ending the request lifecycle, where:
- `result` - if called in the handler, prerequisites, or extension points other than the `'onPreHandler'`
  and `'onPreResponse'`, the `result` argument is not allowed and will throw an exception if present. If
  called within an authentication strategy, it sets the authenticated credentials. If called by the
  `'onPreHandler'` or `'onPreResponse'` extensions, the `result` argument overrides the current response
  including all headers, and returns control back to the framework to continue processing any remaining
  extensions.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

const onRequest = function (request, reply) {

    // Change all requests to '/test'
    request.setUrl('/test');
    return reply.continue();
};

server.ext('onRequest', onRequest);
```

### `reply.entity(options)`

Sets the response 'ETag' and 'Last-Modified' headers and checks for any conditional request headers to
decide if the response is going to qualify for an HTTP 304 (Not Modified). If the entity values match
the request conditions, `reply.entity()` returns control back to the framework with a 304 response.
Otherwise, it sets the provided entity headers and returns `null`, where:
- `options` - a required configuration object with:
	- `etag` - the ETag string. Required if `modified` is not present. Defaults to no header.
	- `modified` - the Last-Modified header value. Required if `etag` is not present. Defaults to no header.
	- `vary` - same as the `response.etag()` option. Defaults to `true`.

Returns a response object if the reply is unmodified or `null` if the response has changed. If `null` is
returned, the developer must call `reply()` to continue execution. If the response is not `null`, the developer
must not call `reply()`.

```js
const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: 80 });

server.route({
    method: 'GET',
    path: '/',
    config: {
        cache: { expiresIn: 5000 },
        handler: function (request, reply) {

            const response = reply.entity({ etag: 'abc' });
            if (response) {
                response.header('X', 'y');
                return;
            }

            return reply('ok');
        }
    }
});
```

### `reply.close([options])`

Concludes the handler activity by returning control over to the router and informing the router
that a response has already been sent back directly via `request.raw.res` and that no further
response action is needed. Supports the following optional options:
- `end` - if `false`, the router will not call `request.raw.res.end())` to ensure the response was
  ended. Defaults to `true`.

No return value.

The [response flow control rules](#flow-control) **do not** apply.

### `reply.redirect(uri)`

Redirects the client to the specified uri. Same as calling `reply().redirect(uri)`.

Returns a [response object](#response-object).

The [response flow control rules](#flow-control) apply.

```js
const handler = function (request, reply) {

    return reply.redirect('http://example.com');
};
```

### `reply.response(result)`

Shorthand for calling [`reply(null, result)`](#replyerr-result), causes a reply with the response
set to `result`.

```js
const handler = function (request, reply) {

    return reply.response('result');
};
```

### `reply.state(name, value, [options])`

Sets a cookie on the [response (see response object methods)](#response-object).

```js
const handler = function (request, reply) {

    reply.state('cookie-name', 'value');
    return reply.response('result');
};
```

### `reply.unstate(name, [options])`

Clears a cookie on the [response (see response object methods)](#response-object).

```js
const handler = function (request, reply) {

    reply.unstate('cookie-name');
    return reply.response('result');
};
```

Changing to a permanent or non-rewritable redirect is also available see
[response object redirect](#response-object-redirect) for more information.
