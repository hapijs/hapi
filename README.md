<a href="/walmartlabs/blammo"><img src="https://raw.github.com/walmartlabs/blammo/master/images/from.png" align="right" /></a>
![hapi Logo](https://raw.github.com/walmartlabs/hapi/master/images/hapi.png)

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

Current version: **0.12.0**

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

## Getting started

To demonstrate a basic example we will be creating a "hello world" service with a single API endpoint.

Start by creating a _package.json_ by running
```
npm init
```

Now install **hapi** and have it saved to your _package.json_ dependencies by running
```
npm install hapi --save
```

Next create an _index.js_ file and add the following contents to it:
```javascript
var Hapi = require('hapi');

// Create a server with a host and port
var server = new Hapi.Server('localhost', 8000);

// Define the route
var hello = {
    handler: function (request) {
    
        request.reply({ greeting: 'hello world' });
    }
};

// Add the route
server.addRoute({
    method: 'GET',
    path: '/hello',
    config: hello
});

// Start the server
server.start();
```

Start the server with `node .` and navigate to the website at 'http://localhost:8000' in a browser.

## [API Reference](docs/Reference.md)
