# The **hapi** API

## `Server`

#### `new Server(host, port, options)`
`createServer(host, port, options)`

#### `server.routingTable()`
#### `server.start(callback)`
#### `server.stop(options, callback)`
#### `server.log(tags, data, timestamp)`
#### `server.route(options)`
#### `server.route(routes)`
#### `server.state(name, options)`
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

