<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
<img src="https://raw.github.com/spumko/hapi/master/images/hapi.png" />

A rich framework for building web applications and services. **hapi** is a simple to use configuration-centric
framework with built-in support for input validation, caching, authentication, and other essential facilities.
**hapi** enables developers to focus on writing reusable application logic instead of spending time building
infrastructure. The framework supports a powerful plugin architecture for pain-free and scalable extensibility.

For the latest updates and release information follow [@hapijs](https://twitter.com/hapijs) on twitter.

Current version: **4.0.x**

[![Build Status](https://secure.travis-ci.org/spumko/hapi.png)](http://travis-ci.org/spumko/hapi)

[![NPM](https://nodei.co/npm/hapi.png?downloads=true&stars=true)](https://nodei.co/npm/hapi/)

## Getting started

Start by creating a _package.json_:
```
npm init
```

Install **hapi** and have it saved to your _package.json_ dependencies:
```
npm install hapi --save
```

Create an _'index.js'_ file and with the following contents:
```javascript
var Hapi = require('hapi');

// Create a server with a host and port
var server = Hapi.createServer('localhost', 8000);

// Add the route
server.route({
    method: 'GET',
    path: '/hello',
    handler: function (request, reply) {
    
        reply('hello world');
    }
});

// Start the server
server.start();
```

Launch the application (`node .`) and open 'http://localhost:8000/hello' in a browser.


## More information

- For the **latest updates** follow [@hapijs](https://twitter.com/hapijs).
-- For more **information, tutorials, and references** on the currently published version, visit [**hapijs.com**](http://hapijs.com)
- For a self-guided lesson on hapi, use [Make Me Hapi](https://github.com/spumko/makemehapi).
- For a full application example, check out [postmile](https://github.com/hueniverse/postmile).
- Information about the **work-in-progress** in the master branch:
    - [API reference](/docs/Reference.md)
    - [Upcoming breaking changes](https://github.com/spumko/hapi/issues?labels=breaking+changes)
- For **discussions** join the [#hapi channel](http://webchat.freenode.net/?channels=hapi) on irc.freenode.net.
- Any **issues or questions** (no matter how basic), open an issue.

