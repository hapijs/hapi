## Plugins

### Prerequisites

1. Hapi version 0.15.x or greater is installed
2. A folder with a package.json and main entry point file exist (index.js)

### Routing with a Plugin

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
