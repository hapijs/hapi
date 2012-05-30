# hapi

A restful api server that separates your business logic from the server gears so you can focus on coding stuff.

### Basic Usage

```js

var hapi = require('hapi');

//create a server with a host, port, and options
var server = new hapi.Server.Server('localhost', 8088, {name:'sample', uri:'0.0.0.0'});

//define the function that returns our value (could be external to this file)
function sampleGet(hapi, reply) {
	reply('hello world');
}

//add the route
server.addRoute({
	path : '/sample',
	method : 'GET',
	handler : sampleGet,
	authentication: 'none'
});

//start the server
server.start();

```

Now navigate to http://localhost:8080/sample and you should receive 'hello world'

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
* `raw` - if true then the request is passed raw to the handler (the request is the same as a Director request)

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
	//hapi.params will have your parameter
	console.log(hapi.params.cor);//album
	reply(albumGet(hapi.params.cor));
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

