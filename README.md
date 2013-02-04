<a href="/walmartlabs/blammo"><img src="https://raw.github.com/walmartlabs/blammo/master/images/from.png" align="right" /></a>
![hapi Logo](https://raw.github.com/walmartlabs/hapi/master/images/hapi.png)

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

For the latest updates and release information follow [@hapijs](https://twitter.com/hapijs) on twitter.

Current version: **0.13.0**

[![Build Status](https://secure.travis-ci.org/walmartlabs/hapi.png)](http://travis-ci.org/walmartlabs/hapi)

## Getting started

To demonstrate a basic example we will be creating a "hello world" service with a single API endpoint.

### Hello World Server

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
server.route({
    method: 'GET',
    path: '/hello',
    config: hello
});

// Start the server
server.start();
```

Start the server with `node .` and navigate to the website at 'http://localhost:8000/hello' in a browser and you will see the following output:
```json
{"greeting":"hello world"}
```

### Hello World Server + Validation

To demonstrate one of the more powerful features in **hapi** we will change the 'hello' route to only respond whenever a _'name'_ is present on the querystring.  Change the _'index.js'_ so that the _'hello'_ config object looks like the following:
```javascript
var hello = {
    handler: function (request) {
    
        request.reply({ greeting: 'hello ' + request.query.name });
    },
    validate: { 
        query: {
            name: Hapi.Types.String().required()
        }
    }
};
```

When you start the server with `node .` and navigate to 'http://localhost:8000/hello' you will get a 400 response with an error explaining that 'name' is required.  When the 'name' is omitted from the querystring the handler will not be called.  However, if you do provide a 'name' it will be echoed out in the response.  If you request 'http://localhost:8000/hello?name=John' then you will get the following response:
```json
{"greeting":"hello John"}
```

To learn more about the various validation options you can read the [validation section](docs/Reference.md#query-validation) in the reference.

## [API Reference](docs/Reference.md)

## [Breaking Changes](https://github.com/walmartlabs/hapi/issues/440)
