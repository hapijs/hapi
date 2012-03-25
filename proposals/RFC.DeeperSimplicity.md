# Deeper Simplicity

Hapi currently doesn't smell right.  

## Boil Down Middleware

Currently, we have at least 6 types of middleware at various explicitly defined stages.  None of them are flexible - only one function can occupy each slot (unless you wrap multiple in one... which becomes verbose and unwieldy).  This reduces clarity, simplicity, and usability.

Here are my proposed abstractions:

* Before each and EVERY request ('before' event)
* Short-circuit-able Middleware (like express/connect style)
* After each and EVERY request ('after' event)

#1 & #3 use events - you can bind multiple functions on a given event and they will be iterated.  

For #2, we expose a Hapi.server.use function which basically just wraps express' use function and let the user control order of operations.

    var api = hapi.createServer();
    
    api.use(express.bodyParser());
    api.use(express.cookieParser());
    api.use(hapi.auth({scheme: 'oauth'}));
    api.use(hapi.throttle(debounceOptions));
    
    api.on('requestBegin', instrument);
    api.on('requestEnd', AniviaClient.logRequest);
    
    api.listen(port, AniviaClient.logListen);

## Error Handling

TODO

## DTrace Probes

TODO

## Hapi Client

TODO: basically need a straightforward json/rest client to reduce repeated boilerplate in connecting to hapi/anivia/etc

