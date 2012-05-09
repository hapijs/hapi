# Deeper Simplicity

Assumption: Hapi currently doesn't smell right.  Here are some proposed beneficial tweaks based on our actual use cases and internal demands.

## Boil Down Middleware

Currently, we have at least 6 types of middleware for various explicitly defined stages of the request pipeline.  None of them are flexible - only one function can occupy each slot (unless you wrap multiple in one... which can become complicated and unwieldy).  This reduces clarity, simplicity, and usability.

Here are my proposed abstractions:

* Before each and EVERY request ('before' event)
* Short-circuit-able Middleware (like express/connect style)
* After each and EVERY request ('after' event)

### 1 & #3 use events - you can bind multiple functions on a given event and they will be iterated.  

For #2, we expose a Hapi.server.use function which basically just wraps express' use function and let the user control order of operations.

    var api = hapi.createServer();
    
    api.use(hapi.Monitor.logger(api));
    api.use(express.bodyParser());
    api.use(express.cookieParser());
    api.use(hapi.auth({scheme: 'oauth'}));
    api.use(hapi.throttle(debounceOptions));
    api.use(hapi.router(endpoints));
    
    api.on('requestBegin', Hapi.Monitor.instrument);
    api.on('requestEnd', Hapi.Monitor.request);
    
    api.listen(port, AniviaClient.logListen);
    
The above event names 'requestBegin' & 'requestEnd' suck.

## Serialization

Support MessagePack for faster serialization of JavaScript objects.  `node-msgpack` is faster than JSON.parse() and JSON.stringify() (90% faster in some cases...).

Example use case is for disk backup of anivia logs.  

Once things are up and running, it is advisable to perform speed tests between our JSON.parse and writing msgpack.pack()'d strings to Mongo. We would likely see tremendous performance and disk space cost benefits.

## Content Negotiation

On server listen, if no eventHandlers are bound to a given event, default ones can be bound (this way, default ones don't run if user specifies any handlers).

TODO: add & revise

## Request-level helpers

TODO

## Retain express callback arguments

Instead of (req, reply){}, use standard express-style arguments (req, res, next){}.  Then, make reply functions as part of req or res object for content-type-specific responses.

    res.reply(data)

This enables cross-hapi-express middleware to be used together without modification.  

### Content Negotiation

We do prefer JSON, but just like how we're asking the Java Services to transition from XML to JSON... we may need to eventually transition to something newer, hotter in a few years.  

But in general, this just needs a better interface for more intuitive development, etc.

TODO: flesh out

## Error Handling

TODO

## DTrace Probes

TODO

## Hapi Client

TODO: basically need a straightforward json/rest client to reduce repeated boilerplate in connecting to hapi/anivia/etc

## Streams support

TODO: esp for client
