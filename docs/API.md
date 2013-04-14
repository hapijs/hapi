# API Reference

## `Server`

#### `new Server([host], [port], [options])`

Creates a new server instance with the following arguments:
- `host` - the hostname or IP address the server is bound to. Defaults to `0.0.0.0` which means any available network
  interface. Set to `127.0.0.1` or `localhost` to restrict connection to those coming from the same machine.
- `port` - the TPC port the server is listening to. Defaults to port `80` for HTTP and to `443` when TLS is configured.
  to use an ephemeral port, use `0` and once the server is started, retrieve the port allocation via `server.settings.port`.
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
- `tls` - options used to create an HTTPS server as described in [TLS](#tls).
- `router` - controls how incoming request URIs are matched against the routing table:
    - `isCaseSensitive` - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to `true`.
    - `normalizeRequestPath` - determines whether request paths should be normalized prior to matching. Normalization percent-encodes reserved
      characters, decodes unreserved characters, and capitalizes any percent encoded values. Useful when serving non-compliant HTTP clients.
      Defaults to `false`.
- `payload` - controls how incoming payloads (request body) are processed:
    - `maxBytes` - limits the size of incoming payloads to the specified byte count. Allowing very large payloads may cause the server to run
      out of memory. Defaults to `1048576` (1MB).
- `files` - defines the behaviour for serving static resources using the built-in route handlers for files and directories:
    - `relativeTo` - determines how relative paths are resolved. Available values:
        - `cwd` - relative paths are resolved using the active process path (`process.cwd()`). This is the default setting.
        - `routes` - relative paths are resolved relative to the source file in which the `server.route()` method is called. This means the
          location of the source code determines the location of the static resources when using relative paths.
        - an absolute path (e.g. '/path') used as prefix for all relative paths.
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
- `state` - HTTP state management (cookies) allows the server to store information on the client which is sent back to the server with every
  request (as defined in [RFC 6265](https://tools.ietf.org/html/rfc6265)).
    - `cookies` - The server automatically parses incoming cookies based on these options:
        - `parse` - determines if incoming 'Cookie' headers are parsed and stored in the `request.cookies` object. Defaults to `true`.
        - `failAction` - determines how to handle cookie parsing errors. Allowed values are:
            - `error` - return a Bad Request (400) error response. This is the default value.
            - `log` - report the error but continue processing the request.
            - `ignore` - take no action.
        - `clearInvalid` - if `true`, automatically instruct the client to remove invalid cookies. Defaults to `false`.
- `timeout` - define timeouts for processing durations:
    - `server` - response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an incoming client request before giving
      up and responding with a Service Unavailable (503) error response. Disabled by default (`false`).
    - `client` - request timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body) before giving up
      and responding with a Request Timeout (408) error response. Set to `false` to disable. Defaults to `10000` (10 seconds). 
    - `socket` - by default, node sockets automatically timeout after 2 minutes. Use this option to override this behaviour. Defaults to `undefined`
      which leaves the node default unchanged. Set to `false` to disable socket timeouts.
- [`debug`](#debug)
- [`cache`](#cache)
- [`authentication`](#authentication)


#### TLS

`tls` is used to create an HTTPS server. The `tls` object is passed unchanged to the node.js HTTPS server and is described
in the [node.js HTTPS documentation](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

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



### Views

To enable Views support, Hapi must be given an options object with a non-null `views` key. The views object
 supports the following options:

- `path` - (Required) the root file path where the request.reply.view function will resolve template names.
- `engine` - the configuration for what template rendering engine will be used (default: handlebars).
    - `module` - the npm module to require and use to compile templates (**this is experimental and may not not work with all modules**).
    - `extension` - the file extension used by template files.
- `engines` - optional configuration for supporting multiple rendering engines
    - `module` - the npm module to require and use 
- `partials` - this key enables partials support if non-null.
    - `path` - the root file path where partials are located (if different from views.path).
- `layout` - if set to true, layout support is enabled (default: false).
- `layoutKeyword` - the key used by the template engine to denote where primary template content should go.
- `encoding` - the text encoding used by the templates.
- `cache` - if set to false, templates will not be cached (thus will be read from file on every use).
- `allowAbsolutePaths` - the flag to set if absolute template paths passed to .view() should be allowed.
- `allowInsecureAccess` - the flag to set if `../` should be allowed in the template paths passed to `.view()`.
- `compileOptions` - the options object passed to the engine's compile function (compile(string, options)).


### Authentication

**hapi** supports several authentication schemes and can be configured with multiple strategies using these schemes (as well as other
extensions). The built-in schemes provided:

- _'basic'_ - HTTP [Basic authentication](#basic-authentication) ([RFC 2617](http://tools.ietf.org/html/rfc2617))
- _'cookie'_ - simple [cookie authentication](#cookie-authentication)
- _'hawk'_ - HTTP [Hawk authentication](#hawk-authentication) ([Hawk protocol](https://github.com/hueniverse/hawk))
- _'bewit'_ - URI [Hawk Bewit](#hawk-bewit-authentication) query authentication ([Hawk protocol](https://github.com/hueniverse/hawk))
- _'oz'_ - experimental web authorization protocol ([Oz protocol](https://github.com/hueniverse/oz))

Authentication setup includes two steps:
- Configure server authentication strategies using the provided schemes (or using an extension implementation). Strategies
  are added using the `server.auth(name, options)` method where:
    - 'name' - is the strategy name ('default' is automatically assigned if a single strategy is defined via the server config object).
    - 'options' - required strategy options. Each scheme comes with its own set of required options, in addition to the options shared
      by all schemes:
        - `scheme` - the built-in scheme name.
        - `implementation` - cannot be used together with `scheme` and is used to provide an object with the **hapi** scheme interface.
        - `defaultMode` - if 'true', is automatically assigned as a required strategy to any route without an `auth` config. Can
          only be assigned to a single server strategy. Value must be 'true' or a valid authentication mode ('required', 'optional', 'try').
- Assign strategies to route via the route config as described in [Configuration options](#configuration-options).

In addition to the `server.auth(name, options)` method, the server can be initially configured with a set of strategies using the config
`auth` key which can be set to a single strategy (name will default to 'default') or an object with multiple strategies where the strategy
name is the object key.

For example, configuring a single strategy:
```javascript
var options = {
    auth: {
        scheme: 'basic',
        loadUserFunc: loadUser
    }
};
```

And configuring multiple strategies:
```javascript
var options = {
    auth: {
        password1: {
            scheme: 'basic',
            loadUserFunc: loadUser1
        },
        password2: {
            scheme: 'basic',
            loadUserFunc: loadUser2
        }
    }
};
```

The _'examples'_ folder contains an _'auth.js'_ file demonstrating the creation of a server with multiple authentication strategies.


#### Basic Authentication

Basic authentication requires validating a username and password combination by looking up the user record via the username and comparing
the provided password with the one stored in the user database. The lookup is performed by a function provided in the scheme configuration
using the `loadUserFunc` option:
```javascript
var loadUser = function (username, callback) {

    // Lookup user records using username...

    if (err) {
        return callback(err);
    }

    return callback(null, user, password);
};

var options = {
    auth: {
        scheme: 'basic',
        loadUserFunc: loadUser
    }
};
```

The _'loadUserFunc'_ callback expects a user object which is passed back once authenticated in `request.auth.credentials`, but is not
used internally by **hapi**. If the user object is null or undefined, it means the user was not found and the authentication fails.

The provided password is compared to the password received in the request. If the password is hashed, the `hashPasswordFunc` scheme option
must be provided to hash the incoming plaintext password for comparisson. For example:

```javascript
var hashPassword = function (password) {
    
    var hash = Crypto.createHash('sha1');
    hash.update(password, 'utf8');
    hash.update(user.salt, 'utf8');

    return hash.digest('base64');
};


var options = {
    auth: {
        scheme: 'basic',
        loadUserFunc: loadUser,
        hashPasswordFunc: hashPassword
    }
};
```


#### Cookie Authentication

***hapi*** has built-in support for cookie authentication.  Cookie authentication can be enabled with the _'cookie'_ scheme.  Below are the options available in a strategy that is using the _'cookie'_ scheme.

- `scheme` - 'cookie'
- `password` - used for deriving a key using PBKDF2
- `ttl` - sets the cookie expires time in milliseconds
- `cookie` - name of cookie used to save state
- `clearInvalid` - when _'true'_ any authentication cookie that fails to authenticate will be marked as expired on the response
- `validateFunc` - function that has the signature _'(session, callback)'_ and determines if the session passes authentication.  The callback function has the following signature _'(err, override)'_ where an _'err'_ indicates that authentication failed.  The _'override'_ object will change any cookie properties when setting state on the response.

Below is an example of configuring a server to use cookie authentication.

```javascript
var Hapi = require('hapi');

var validateCookie = function (session, callback) {
    
    return callback(session.user === 'valid' ? null : new Error('bad user'), null);
};

var config = {
    auth: {
        scheme: 'cookie',
        password: 'secret',
        ttl: 60 * 1000,                 // Expire after a minute
        cookie: 'membership',           // Cookie name
        clearInvalid: true,
        validateFunc: validateCookie
    }
};

var server = new Hapi.Server(config);
```

#### Hawk Authentication

The [hawk authentication](https://github.com/hueniverse/hawk) scheme can be enabled similarly to basic authentication.  Hawk requires a function that takes an _'id'_ and passes credentials to the callback.  Below is an example of a function like this and using it with hapi.

```javascript
var Hapi = require('hapi');

var credentials = {
    'john': {
        cred: {
            id: 'john',
            key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
            algorithm: 'sha256'
        }
    }
}

var getCredentials = function (id, callback) {
   
    return callback(null, credentials[id] && credentials[id].cred);
};

var config = {
    auth: {
        scheme: 'hawk',
        getCredentialsFunc: getCredentials
    }
};

var server = new Hapi.Server(config);
```

In the above example only the user 'john' can authenticate, all other users will result in an error.

#### Hawk Bewit Authentication

[Hawk](https://github.com/hueniverse/hawk) allows for authentication to endpoints by constructing a specially formed URI.  To learn more about this feature in general please read the [Single URI Authorization](https://github.com/hueniverse/hawk#single-uri-authorization) section of the hawk readme.  Hapi supports this type of authentication through use of the _'bewit'_ scheme.  Only endpoints using the _'GET'_ HTTP method are allowed to support the _'bewit'_ scheme.  Below is an example of how to enable _'bewit'_ support on a server.

```javascript
var Hapi = require('hapi');

var credentials = {
    'john': {
        cred: {
            id: 'john',
            key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
            algorithm: 'sha256'
        }
    }
}

var getCredentials = function (id, callback) {
   
    return callback(null, credentials[id] && credentials[id].cred);
};

var config = {
    auth: {
        scheme: 'bewit',
        getCredentialsFunc: getCredentials
    }
};

var server = new Hapi.Server(config);
```

From a client perspective the URI must contain the _'bewit'_ querystring key with the bewit token value.  Below is an example of constructing a URI to a resource with the _'bewit'_ key.

```javascript
var Hawk = require('hawk');

var cred = {
    id: 'john',
    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
    algorithm: 'sha256'
};

var bewit = Hawk.uri.getBewit(cred, '/endpoint', 'site.com', 80, 60);           // Valid for 1 minute
var uri = 'http://site.com/endpoint?bewit=' + bewit;
```


### Cache

**hapi** provides built-in caching capabilities for storing and reusing request responses and helpers utilities. The provided
implementations include memory, Redis, and MongoDB support (each server must be manually installed and configured). The cache
functionality is always enabled and if not configured otherwise, defaults to a memory store. The memory store is not suitable
for production environments. Caching will only be utilized if routes, helpers, and plugins explicitly instruct the server to keep
items in the cache.

To change the cache properties, the `cache` option must be set to an object with the following options:
- `engine` - the cache server implementation. Options are _redis_, _mongodb_, and _memory_.
- `host` - the cache server hostname.
- `port` - the cache server port.
- `partition` - the partition name used to isolate the cached results across different servers. Defaults to 'hapi-cache'. Used as the database name in MongoDB.
- `username`, `password`, `poolSize` - MongoDB-specific options.
- `maxByteSize` - sets an upper limit on the number of bytes that can be stored when using a memory cache. Defaults to no limit.

For convenience, pre-configured options are provided for Redis, MongoDB, and memory store. To use them, simply set the server's `cache` option to:
- _'redis'_ - Connects to _127.0.0.1:6379_ using partition name 'hapi-cache'.
- _'mongodb'_ - Connects to _127.0.0.1:27017_ using partition name 'hapi-cache', no authentication, and pool size 5.
- _'memory'_ - This is an experimental engine and should be avoided in production environments.  The memory engine will run within the node process and supports the following option:

For example:
```javascript
var options = {
    cache: 'redis'
};
```

### Debug

By default, **hapi** does not print much to the console. However, it is set to output any uncaught errors thrown in non-hapi code as those are handled
automatically and result in a 500 error response. To change the type of events logged to the console, change the server config `debug.request` array to
the list of request log tags you would like to see no the console. For example, also print error events:

```javascript
var server = new Hapi.Server({ debug: { request: ['error', 'uncaught'] } });
```

To turn off all console print outs:
```javascript
var server = new Hapi.Server({ debug: false });
```


#### `server.routingTable()`
#### `server.start(callback)`
#### `server.stop(options, callback)`
#### `server.log(tags, data, timestamp)`
#### `server.route(options)`
#### `server.route(routes)`
#### `server.state(name, options)`

Please note that when using the _'log'_ fail action that the server will emit a _'request'_ event that has a request and event object being passed to any event handler.  For example, the following demonstrates how to check for errors from cookie parsing:

```javascript
server.on('request', function (request, event, tags) {
    
   if (tags.error && tags.state) {
       // cookie parsing error
   } 
});
```


#### `server.auth(name, options)`
#### `server.ext(event, method)`
#### `server.helper(name, method, options)`
#### `server.inject(options, callback)`


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

#### `exports.register(pack, options, next)`

### Selectable methods

#### `pack.select(labels)`
#### `pack.length`
#### `pack.api(key, value)`
#### `pack.api(obj)`
#### `pack.route(options)`
#### `pack.route(routes)`
#### `pack.state(name, options)`
#### `pack.auth(name, options)`
#### `pack.ext(event, method)`

### Root methods

#### `pack.version`
#### `pack.hapi`
#### `pack.app`
#### `pack.log(tags, data, timestamp)`
#### `pack.dependency(deps)`
#### `pack.events`
#### `pack.views(options)`
#### `pack.helper(name, method, options)`
#### `pack.cache(options, segment)`

