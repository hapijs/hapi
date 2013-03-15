## Plugins

### Prerequisites

1. Hapi version 0.15.x or greater is installed
2. A folder with a package.json and main entry point file exist (index.js)

Please read the reference guide for an overview of creating the [plugin structure](docs/Reference.md#creating-a-plugin).

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

Next call _'route'_ and then call _'next'_.

```javascript
pack.route({ method: 'GET', path: '/', handler: function (request) {

  request.reply('Hello Plugins');
}});
next();
```

In the event that a pack doesn't grant the _'route'_ permission an exception will be thrown.  Therefore, there isn't a need to check first for this function unless the plugin will work without it.

Below is what the final plugin looks like:

```javascript
exports.register = function (pack, options, next) {
  
  pack.route({ method: 'GET', path: '/', handler: function (request) {

    request.reply('Hello Plugins');
  }});
  next();
};
```

### Plugging into a Subset of Servers

The _'register'_ method for a plugin is passed a _'pack'_ object.  This object has a _'select'_ method that returns a pack of servers that match the provided criteria.  In the following, all of the servers that support TLS will be selected and a route will be added to them.

Begin by exporting the _'register'_ function within the module.

```javascript
exports.register = function (pack, options, next)
```

Now call the _'select'_ method on _'pack'_ and look for the pack of servers that have the 'secure' label.

```javascript
var securePack = pack.select({ label: 'secure' });
```

The result of calling _'select'_ will be a subset package of any server that match the criteria.  The result will have the same methods that existed on the original _'pack'_ object passed in.

Before calling any of the methods on _'securePack'_ check to make sure that any servers were found that meet the criteria by checking _'length'_.

```javascript
if (!securePack.length) {
    return next(new Error('No secure servers found'));   
}
```

Finally add a route that is now guranteed to be applied to only servers that support TLS.

```javascript
securePack.route({ method: 'GET', path: '/', handler: function (request) {

    request.reply('Hello Secure Server');
}});
```

The complete plugin _'register'_ function is shown below, including the call of _'next'_.

```javascript
exports.register = function (pack, options, next) {

    var securePack = pack.select({ label: 'secure' });
    if (!securePack.length) {
        return next(new Error('No secure servers found'));   
    }
    
    securePack.route({ method: 'GET', path: '/', handler: function (request) {

        request.reply('Hello Secure Server');
    }});
    
    next();
};
```
