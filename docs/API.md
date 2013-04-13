# **hapi**

The **hapi** module root.

## `error`

An alias of the [**boom**](https://github.com/spumko/boom) module. Can be accessed via `hapi.error` or `hapi.boom`.

### `badRequest(message)`
### `unauthorized(error, scheme, attributes)`
### `unauthorized(error, wwwAuthenticate)`
### `clientTimeout(message)`
### `serverTimeout(message)`
### `forbidden(message)`
### `notFound(message)`
### `internal(message, data)`
### `passThrough(code, payload, contentType, headers)`

## `Error`

An alias of the [**boom**](https://github.com/spumko/boom) module. Can be accessed via `hapi.Error` or `hapi.Boom`.

### `new Error(code, message)`
### `new Error(error)`

## `createServer(host, port, options)`

## `Server`

### `new Server(host, port, options)`
### `routingTable()`
### `start()`
### `stop()`
### `log(tags, data, timestamp)`
### `route(options)`
### `route(routes)`
### `state(name, options)`
### `auth(name, options)`
### `ext(event, method)`
### `helper(name, method, options)`
### `inject(options, callback)`


## `response`

### `Generic`
### `Cacheable`
### `Empty`
### `Obj`
### `Text`
### `Stream`
### `File`
### `Directory`
### `Redirection`
### `View`
### `Buffer`


## `utils`

An alias of the [**hoek**](https://github.com/spumko/hoek) module.

# `version`


## `types`

See [**joi** Types](https://github.com/spumko/joi#type-registry).

## `Pack`

### `new Pack(options)`
### `server(host, port, options)`
### `start(callback)`
### `stop(options, callback)`
### `require(name, options, callback)`
### `require(names, callback)`
### `register(plugin, options, callback)`
### `allow(permissions)`

## `Composer`

### `new Composer(manifest)`
### `compose(callback)`
### `start(callback)`
### `stop(callback)`


## `state`

### `prepareValue()`


# Plugin Interface

## `register(pack, options, next)`
## `pack`
### `select(labels)`
### `length`
### `api(key, value)`
### `api(obj)`
### `route(options)`
### `route(routes)`
### `state(name, options)`
### `auth(name, options)`
### `ext(event, method)`

### `version`
### `hapi`
### `app`
### `log(tags, data, timestamp)`
### `dependency(deps)`
### `events`
### `views(options)`
### `helper(name, method, options)`
### `cache(options, segment)`

