<img src="https://raw.github.com/hapijs/hapi/master/images/hapi.png" />

### Web and services application framework

Lead Maintainer: [Eran Hammer](https://github.com/hueniverse)

**hapi** is a simple to use configuration-centric framework with built-in support for input validation, caching,
authentication, and other essential facilities for building web and services applications. **hapi** enables
developers to focus on writing reusable application in a highly modular and prescriptive approach.

For the latest updates and release information visit [hapijs.com](http://hapijs.com) and follow [@hapijs](https://twitter.com/hapijs) on twitter.

## Getting Started

Start by creating a `package.json`:

```bash
$ npm init
```

Install hapi and save it to your `package.json` dependencies:

```bash
$ npm install hapi --save
```

Create an `index.js` file with the following contents:

```javascript
var Hapi = require('hapi');

// Create a server with a host and port
var server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

// Add the route
server.route({
  method: 'GET',
  path:'/hello',
  handler: function (request, reply) {
    reply('hello world');
  }
});

// Start the server
server.start();
```

Launch the application by running `node .` and open localhost:8000/hello in your browser.

For more example usage check out [tutorials](http://hapijs.com/tutorials)

## Using plugins

A common desire when creating any web application, is an access log. To add some basic logging to our application, let's load the [good](https://github.com/hapijs/good) plugin and its [good-console](https://github.com/hapijs/good-console) reporter on to our server.

The plugin first needs to be installed:

```bash
$ npm install --save good
$ npm install --save good-console
```

Then update your `server.js`:

```javascript
var Hapi = require('hapi');
var Good = require('good');

var server = new Hapi.Server();
server.connection({ port: 3000 });

server.route({
  method: 'GET',
  path: '/',
  handler: function (request, reply) {
    reply('Hello, world!');
  }
});

server.route({
  method: 'GET',
  path: '/{name}',
  handler: function (request, reply) {
    reply('Hello, ' + encodeURIComponent(request.params.name) + '!');
  }
});

server.register({
  register: Good,
  options: {
    reporters: [{
      reporter: require('good-console'),
      args:[{ log: '*', response: '*' }]
    }]
  }
}, function (err) {
    if (err) {
      throw err; // something bad happened loading the plugin
    }

    server.start(function () {
      server.log('info', 'Server running at: ' + server.info.uri);
    });
});
```

Now when the server is started you'll see:

```bash
140625/143008.751, info, Server running at: http://localhost:3000
```

And if we visit `http://localhost:3000/` in the browser, you'll see:

```bash
140625/143205.774, request, http://localhost:3000: get / {} 200 (10ms)
```

This is just one short example of what plugins are capable of, for more information check out the [plugins tutorial](http://hapijs.com/tutorials/plugins)

## Version

Development version: **8.1.x** ([release notes](https://github.com/hapijs/hapi/issues?labels=release+notes&page=1&state=closed))
[![Build Status](https://secure.travis-ci.org/hapijs/hapi.svg)](http://travis-ci.org/hapijs/hapi)

## Support

If you have questions, please open an issue in the [discussion forum](https://github.com/hapijs/discuss).
