## Plugins

### Prerequisites

1. Hapi version 0.15.x or greater is installed
2. A folder with a package.json and main entry point file exist (index.js)

### Creating an API

A plugin always has the ability to add properties and methods to the _'api'_ object.  This object is useful for exposing any functionality publically.  This tutorial will demonstrate how to add a function and property to this object.

Export a register function that looks like the following:

```javascript
exports.register = function (pack, options, next) {
    
    pack.api.hello = 'Hello';
    pack.api.world = 'World';
    pack.api.sayHello = sayHello;
    
    next();
};


function sayHello () {
  
  console.log(this.hello + ' ' + this.world);
}
```

In the above the _'sayHello'_ is called with the plugin api as the context.  Therefore, it is possible to refer to the plugin api properties using _'this'_.  The _'sayHello'_ function and the other properties are also accessible under the _'server.plugins["plugin name"]'_ object, where "plugin name" is the name of the installed plugin to access.  Below is an example of requiring the previous plugin and executing the _'sayHello'_ function.

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server(8080);

server.plugin.require('api-plugin', function (err) {

    if (!err) {
        server.start(function () {
            
            server.plugins['api-plugin'].sayHello();
        });
    }
});
```

After the plugin is successfully required the server is started and then the plugin api method is invoked, outputting 'Hello World' to the console.

### Routing

When a pack allows the _'route'_ permission then any plugin within the pack can add routes to the server.  In the plugin module export a _'register'_ function with the following signature:

```javascript
exports.register = function (pack, options, next)
```

Next, make sure that the _'pack'_ allows for the plugin to add routes by checking that _'pack.route'_ is a function.

```javascript
console.assert(typeof pack.route === 'function', 'Plugin permissions must allow route');
```

If the _'pack'_ allows the route permission then go ahead and add a new route and then call _'next'_.

```javascript
pack.route({ method: 'GET', path: '/', handler: function (request) {

  request.reply('Hello Plugins');
}});
next();
```

Below is what the final plugin looks like:

```javascript
exports.register = function (pack, options, next) {

  console.assert(typeof pack.route === 'function', 'Plugin permissions must allow route');
  pack.route({ method: 'GET', path: '/', handler: function (request) {

    request.reply('Hello Plugins');
  }});
  next();
};
```
