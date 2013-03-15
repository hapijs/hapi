<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
<img src="https://raw.github.com/spumko/hapi/master/images/hapi.png" />

A rich framework for building restful API services. **hapi** is a configuration-centric framework in which
authentication requirements, input validation, data caching and pre-fetching, developer documentation,
and other essential facilities are provided out-of-the-box and enabled using simple JSON configuration
objects. **hapi** enables developers to focus on writing reusable business logic instead of spending time
with everything else.

For the latest updates and release information follow [@hapijs](https://twitter.com/hapijs) on twitter.

Current version: **0.15.4**

[![Build Status](https://secure.travis-ci.org/spumko/hapi.png)](http://travis-ci.org/spumko/hapi)
<img src="https://raw.github.com/olivierlacan/shields/master/coveralls/coveralls_100.png" />


### [API Reference](/docs/Reference.md)

### [Tutorials](/docs/Tutorials.md)

### [Plugins](/docs/Plugins.md)

### [Breaking Changes](https://github.com/spumko/hapi/issues?labels=breaking+changes&state=closed)

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

Next create an _'index.js'_ file and add the following contents to it:
```javascript
var Hapi = require('hapi');

// Create a server with a host and port
var server = Hapi.createServer('localhost', 8000);

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


### Hello Static Server

The **hapi** route handler can be used to easily serve files, directories, render templates, and even proxy requests.  In this example the _'directory'_ handler will be used to create a static site serving files in the _'public'_ folder.  Remove the `hello` variable and make the `server.route` command look like the following:
```javascript
server.route({
    method: 'GET',
    path: '/{path*}',
    handler: {
        directory: { path: './public', listing: false, index: true }
    }
});
```

Create a folder named _'public'_ and add a _'index.html'_ file in the folder with the following contents:
```html
<html>
    <head><title>Hello Static</title></head>
    <body>
        Hello Static
    </body>
</html>
```

Now when you request 'http://localhost:8000' you will see the html page rendered.  You can add other files in this folder and they will be served.  This is a good solution for serving static assets like images and css files.


### Hello Templates Server

To demonstrate how to use **hapi** to render templates we will be creating a template and rendering it using the [handlebars](http://handlebarsjs.com/) engine.  Begin by installing handlebars by running the following npm command:
```bash
npm install handlebars
```

Next create a directory named _'templates'_ that will contain the template files.  In this directory create a _'index.html'_ with the following contents:
```html
<html>
    <head><title>{{greeting}}</title></head>
    <body>
        {{greeting}}
    </body>
</html>
```

The next step is going to be to tell the **hapi** server to use templates and the handlebars engine.  After this, the route handler will be updated to render the template using an object that contains a _'greeting'_ property we want displayed.  Change the _'index.js'_ file so that it looks like the following:
```javascript
var Hapi = require('hapi');

var options = {
    views: {
        path: './templates',
        engine: {
            module: 'handlebars'
        }
    }
};

// Create a server with a host, port, and options
var server = Hapi.createServer('localhost', 8000, options);

// Define the route
var hello = {
    handler: function (request) {
    
      // Render the view with the custom greeting
        request.reply.view('index.html', { greeting: 'hello world' }).send();
    }
};

// Add the route
server.route({
    method: 'GET',
    path: '/',
    config: hello
});

// Start the server
server.start();
```

When you run the server with `node .` and view the homepage you will see the custom greeting message rendered.  More information on using templates with **hapi** can be found in the [views](docs/Reference.md#views) section of the [API Reference](docs/Reference.md).

### Community

For discussion about hapi join the [#hapi channel](http://webchat.freenode.net/?channels=hapi) on irc.freenode.net.

### [Contributors](https://github.com/spumko/hapi/contributors)
