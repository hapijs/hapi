<img src="https://raw.github.com/walmartlabs/hapi/master/images/hapi.png" />

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documenentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of speding time
with everything else.

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

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

        reply({ greeting: 'hello world' });
    }
};
    
// Add the route
server.addRoute({
    method : 'GET',
    path : '/hello',
    config : hello
});

// Start the server
server.start();
```

Now navigate to http://localhost:8080/hello and you should receive 'hello world'.

## Server Configration

**hapi** provides a rich set of configuration options for each server instance:

  - [`tls`](https://github.com/walmartlabs/hapi/edit/user/eran/Readme.md#tls)
  - `router`
  - `payload`
  - `cors`
  - `ext`
  - `monitor`
  - `authentication`
  - `cache`
  - `debug`

### TLS

### Routes

#### Configuration options

* `path` - endpoint (see [Director](https://github.com/flatiron/director "Director") for endpoint matching patterns )
* `method` - http method for routing endpoint
* `handler` - Function to handle request
* `authentication` - Type of authentication
* `tos` - Terms of Service required for that request
* `query` -
* `schema` -
* `scope` -

#### Wildcards

Wildcard declaration in routes are handled the same way as they are in Director or Express. Their retrieval on the handler is handled a little differently.

```js
//when you add a route like this:
server.addRoute({
path : '/luna/:album',
method : 'GET',
handler : albumRetrieve,
authentication: 'none'
});

function albumRetrieve(hapi, reply) {
//hapi.params will have the parameter
console.log(hapi.params.album);
reply(albumGet(hapi.params.album));
}
```

### Handlers

Each handler needs two parameters, usually named 'hapi' and 'reply'.

* `hapi` - the first parameter. provides request information
* `reply` - function to call that takes a json body as a response

### Middleware

hapi provides a few places where middleware can be added into the functions being called for each request. They are:

* `onPreRoute` - gets called before the request is routed.
* `onPreHandler` - gets called after the request has been routed before the assigned handler is called
* `onPostHandler` - gets called after the request headers
* `onPostRoute` - called after all the routes have been matched

Add them via the 'ext' portion  of the options.

```js
var server = new hapi.Server.Server('localhost', 8088, {name:'sample', uri:'0.0.0.0', ext: {onPreRoute:myPreRouteFunction}});
```

### Utils

hapi provides a myriad of util functions for your use
* `abort(message)` - logs message to console and exits the process.
* `clone(obj)` - clones an object or array
* `getTimeStamp()` - gives a 'now' timestamp
* `hide(object, definition)` - removes hidden keys
* `map(array, key)` - turns an array into an object
* `merge(target, source)` - Merge all the properties of source into target; source wins in conflict
* `unique(array, key)` - removes duplicates from an array








