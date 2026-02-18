
## TypeScript Support

hapi ships built-in TypeScript definitions (`.d.ts`) — no `@types/hapi` package needed.
The type system is designed around two complementary patterns:

- **Module augmentation** — declare global types that apply to every route (e.g. `UserCredentials`, `ServerApplicationState`).
- **Generic refs** — pass per-route type overrides via `ServerRoute<Refs>`, `Request<Refs>`, and `Lifecycle.Method<Refs>`.

Both patterns can be used together. Module augmentation sets the baseline; generic refs narrow types for individual routes.


## Quick Start

```typescript
import { server as createServer, ServerRoute, Request, ResponseToolkit } from '@hapi/hapi';

interface AppSpace {
    startedAt: number;
}

const server = createServer<AppSpace>({ port: 3000 });
server.app.startedAt = Date.now();

const route: ServerRoute<{ Params: { id: string } }> = {
    method: 'GET',
    path: '/users/{id}',
    handler: (request, h) => {

        const id: string = request.params.id;
        return { id };
    }
};

server.route(route);
```

`createServer<AppSpace>()` types `server.app` to the `AppSpace` interface. The route generic `{ Params: { id: string } }` overrides the default params type for that specific route.


## The ReqRef System

The ReqRef system is the core architecture that makes per-route typing work. It consists of three pieces:

### `InternalRequestDefaults`

Defines every customizable key and its default type:

| Key                    | Default Type                                      | Controls                                       |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `Payload`              | `stream.Readable \| Buffer \| string \| object`   | `request.payload`                              |
| `Query`                | `Record<string, string \| string[] \| undefined>` | `request.query`                                |
| `Params`               | `Record<string, string>`                          | `request.params`                               |
| `Pres`                 | `Record<string, any>`                             | `request.pre`                                  |
| `Headers`              | `Record<string, string \| string[] \| undefined>` | `request.headers`                              |
| `RequestApp`           | `RequestApplicationState`                         | `request.app`                                  |
| `AuthUser`             | `UserCredentials`                                 | `request.auth.credentials.user`                |
| `AuthApp`              | `AppCredentials`                                  | `request.auth.credentials.app`                 |
| `AuthApi`              | `ServerAuthSchemeObjectApi`                       | `server.auth.api`                              |
| `AuthCredentialsExtra` | `Record<string, unknown>`                         | Extra properties on `request.auth.credentials` |
| `AuthArtifactsExtra`   | `Record<string, unknown>`                         | `request.auth.artifacts`                       |
| `Rules`                | `RouteRules`                                      | `route.rules`                                  |
| `Bind`                 | `object \| null`                                  | `this` binding in lifecycle methods            |
| `RouteApp`             | `RouteOptionsApp`                                 | `route.options.app`                            |
| `Server`               | `Server`                                          | `request.server`                               |

### `ReqRefDefaults`

```typescript
interface ReqRefDefaults extends InternalRequestDefaults {}
```

This is the interface you augment via `declare module` to change defaults globally. Any key you add here overrides `InternalRequestDefaults` for all routes that don't provide their own refs.

### `ReqRef` and `MergeRefs<T>`

```typescript
type ReqRef = Partial<Record<keyof ReqRefDefaults, unknown>>;
type MergeType<T, U> = Omit<T, keyof U> & U;
type MergeRefs<T extends ReqRef> = MergeType<ReqRefDefaults, T>;
```

`MergeRefs<T>` takes a partial override object and merges it with `ReqRefDefaults`. Keys you provide replace the defaults; keys you omit keep the defaults. This is how per-route typing works — you only specify what's different.

### Example

```typescript
interface MyRefs {
    Params: { id: string };
    Query: { expand?: string };
}

// MergeRefs<MyRefs> resolves to:
// {
//     Params: { id: string };           ← overridden
//     Query: { expand?: string };        ← overridden
//     Payload: stream.Readable | ...;   ← default preserved
//     Headers: Record<string, ...>;     ← default preserved
//     ...all other defaults preserved
// }

const route: ServerRoute<MyRefs> = {
    method: 'GET',
    path: '/items/{id}',
    handler: (request, h) => {

        const id: string = request.params.id;       // typed
        const expand: string | undefined = request.query.expand; // typed
        return { id };
    }
};
```


## Typing Request Properties


### Params

Default: `Record<string, string>`. URL path parameters are always strings at runtime (before validation), so the default type reflects this.

```typescript
// Override with specific param names
const route: ServerRoute<{ Params: { userId: string; postId: string } }> = {
    method: 'GET',
    path: '/users/{userId}/posts/{postId}',
    handler: (request, h) => {

        const userId: string = request.params.userId;
        const postId: string = request.params.postId;
        return { userId, postId };
    }
};
```


### Query

Default: `Record<string, string | string[] | undefined>`. Query params may be strings, arrays (repeated keys), or absent.

```typescript
interface SearchQuery {
    q: string;
    page?: string;
    tags?: string[];
}

const route: ServerRoute<{ Query: SearchQuery }> = {
    method: 'GET',
    path: '/search',
    handler: (request, h) => {

        const q: string = request.query.q;
        const page: string | undefined = request.query.page;
        return { q, page };
    }
};
```


### Payload

Default: `stream.Readable | Buffer | string | object`. Override when you know the parsed shape.

```typescript
interface CreateUserPayload {
    name: string;
    email: string;
}

const route: ServerRoute<{ Payload: CreateUserPayload }> = {
    method: 'POST',
    path: '/users',
    options: {
        payload: { output: 'data', parse: true }
    },
    handler: (request, h) => {

        const name: string = request.payload.name;
        return h.response({ created: true }).code(201);
    }
};
```


### Headers

Default: `Record<string, string | string[] | undefined>`. Matches Node's `http.IncomingHttpHeaders` behavior. Override only if you need to narrow specific header names.


### RequestApp

Default: `RequestApplicationState` (empty, augmentable). Per-request application state via `request.app`.

```typescript
const route: ServerRoute<{ RequestApp: { startTime: number } }> = {
    method: 'GET',
    path: '/',
    handler: (request, h) => {

        request.app.startTime = Date.now();
        return 'ok';
    }
};
```


## Authentication Types

hapi's auth type system has three layers: global interfaces (via module augmentation), ReqRef keys (per-route), and the `AuthCredentials` generic that merges them.


### Global: `UserCredentials` and `AppCredentials`

Augment these to define your application's user and app credential shapes. They apply everywhere.

```typescript
declare module '@hapi/hapi' {
    interface UserCredentials {
        id: string;
        name: string;
        email: string;
    }

    interface AppCredentials {
        clientId: string;
        clientName: string;
    }
}
```

After augmentation, `request.auth.credentials.user` is typed as `UserCredentials` and `request.auth.credentials.app` as `AppCredentials` on all routes.


### Per-Route: `AuthCredentialsExtra` and `AuthArtifactsExtra`

Use these ReqRef keys to add extra properties to `request.auth.credentials` and `request.auth.artifacts` for specific routes.

```typescript
interface MyRouteRefs {
    AuthUser: { id: string; name: string; email: string };
    AuthApp: { key: string; name: string };
    AuthCredentialsExtra: { token: string };
    AuthArtifactsExtra: { provider: string; raw: object };
}

const route: ServerRoute<MyRouteRefs> = {
    method: 'GET',
    path: '/profile',
    handler: (request, h) => {

        // credentials = AuthCredentials<AuthUser, AuthApp> & AuthCredentialsExtra
        const token: string = request.auth.credentials.token;
        const email: string = request.auth.credentials.user!.email;

        // artifacts = AuthArtifactsExtra
        const provider: string = request.auth.artifacts.provider;

        return { token, email, provider };
    }
};
```


### How Credentials Resolve

`request.auth` is typed as `RequestAuth<AuthUser, AuthApp, CredentialsExtra, ArtifactsExtra>` where:

- `credentials` resolves to `AuthCredentials<AuthUser, AuthApp> & CredentialsExtra`
  - `AuthCredentials` provides `.scope`, `.user`, and `.app`
  - `CredentialsExtra` adds any extra top-level credential properties
- `artifacts` resolves to `ArtifactsExtra`


### Augmenting `ReqRefDefaults` for Global Auth

You can override `AuthCredentialsExtra` globally via `ReqRefDefaults` augmentation:

```typescript
declare module '@hapi/hapi' {
    interface ReqRefDefaults {
        AuthCredentialsExtra: Partial<{ sessionId: string }>;
    }
}

// Now ALL routes (even generic ones) see `credentials.sessionId`
function handler(request: Request): string {

    const sid = request.auth.credentials.sessionId; // string | undefined
    return sid ?? 'anonymous';
}
```

This is useful for properties that your auth scheme always sets, regardless of route.


## Module Augmentation

Module augmentation uses TypeScript's `declare module` to extend hapi's interfaces globally. The following interfaces support augmentation:

| Interface                   | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `UserCredentials`           | Shape of `request.auth.credentials.user` |
| `AppCredentials`            | Shape of `request.auth.credentials.app`  |
| `RequestApplicationState`   | Shape of `request.app`                   |
| `ServerApplicationState`    | Shape of `server.app`                    |
| `RouteOptionsApp`           | Shape of `route.options.app`             |
| `ServerMethods`             | Typed server methods                     |
| `Request`                   | Request decorations                      |
| `ResponseToolkit`           | Toolkit decorations                      |
| `Server`                    | Server decorations                       |
| `ReqRefDefaults`            | Global defaults for all ReqRef keys      |
| `PluginProperties`          | Typed `server.plugins`                   |
| `PluginsStates`             | Typed `request.plugins`                  |
| `ServerAuthSchemeObjectApi` | Shape of `server.auth.api`               |
| `RouteOptionTypes`          | Auth strategy/scope type narrowing       |
| `RouteRules`                | Shape of `route.rules`                   |
| `HandlerDecorations`        | Custom handler types                     |

### When to Use Augmentation vs Generic Refs

**Module augmentation** when the type applies to every route in your application:

- Auth credentials (you have one auth scheme)
- `request.app` state (same shape everywhere)
- Server decorations and methods

**Generic refs** when the type is route-specific:

- Params, Query, Payload (different per route)
- Route-specific auth overrides
- Pre-handler results

The two work together — augmentation sets the global baseline, and generic refs narrow per-route.


## Plugins

### Defining a Plugin

```typescript
import { Plugin, Server } from '@hapi/hapi';

interface MyPluginOptions {
    prefix: string;
    debug?: boolean;
}

const myPlugin: Plugin<MyPluginOptions> = {
    name: 'my-plugin',
    version: '1.0.0',
    register: async (server: Server, options: MyPluginOptions) => {

        server.expose('getPrefix', () => options.prefix);

        server.route({
            method: 'GET',
            path: '/status',
            handler: () => ({ status: 'ok', prefix: options.prefix })
        });
    }
};
```


### Typed Plugin Decorations

The second type parameter of `Plugin<Options, Decorations>` declares what the plugin exposes on the server. This lets `server.register()` return a server with typed `plugins` access.

```typescript
interface MyPluginDecorations {
    plugins: {
        'my-plugin': {
            getPrefix(): string;
        };
    };
}

const myPlugin: Plugin<MyPluginOptions, MyPluginDecorations> = {
    name: 'my-plugin',
    version: '1.0.0',
    register: async (server, options) => {

        server.expose('getPrefix', () => options.prefix);
    }
};

// Registration returns server with typed plugins
const loaded = await server.register({
    plugin: myPlugin,
    options: { prefix: '/api' }
});

const prefix: string = loaded.plugins['my-plugin'].getPrefix();
```


### `ServerRegisterPluginObject`

When registering with options, wrap in `ServerRegisterPluginObject`:

```typescript
import { ServerRegisterPluginObject } from '@hapi/hapi';

const registration: ServerRegisterPluginObject<MyPluginOptions, MyPluginDecorations> = {
    plugin: myPlugin,
    options: { prefix: '/api', debug: true }
};

const loaded = await server.register(registration);
```


## Server Methods

Server methods are functions registered with the server and accessed via `server.methods`. They support built-in caching.


### Augmenting `ServerMethods`

```typescript
import { CachedServerMethod } from '@hapi/hapi';

declare module '@hapi/hapi' {
    interface ServerMethods {
        utils: {
            add: CachedServerMethod<(a: number, b: number) => number>;
        };
    }
}
```


### Registering a Method

```typescript
server.method('utils.add', (a: number, b: number) => a + b, {
    cache: {
        expiresIn: 60000,
        generateTimeout: 100
    },
    generateKey: (a: number, b: number) => `${a}:${b}`
});
```

Nested names (e.g. `'utils.add'`) automatically create the object hierarchy under `server.methods`.


### Using Cached Methods

```typescript
// Call the method
const sum: number = await server.methods.utils.add(1, 2);

// Access cache controls (available when cache is configured)
await server.methods.utils.add.cache?.drop(1, 2);
const stats = server.methods.utils.add.cache?.stats;
```

`CachedServerMethod<T>` extends the method type `T` with an optional `.cache` property that provides `drop()` and `stats`.


## Decorations

`server.decorate()` extends framework interfaces with custom properties. TypeScript requires declaring the types via module augmentation first, then calling `server.decorate()`.

### Step 1: Declare Types

```typescript
declare module '@hapi/hapi' {
    interface Request {
        getIp(): string;
    }

    interface ResponseToolkit {
        success(data: object): object;
    }

    interface Server {
        getUptime(): number;
    }
}
```


### Step 2: Register Decorations

```typescript
// Request decoration
server.decorate('request', 'getIp', function (this: Request) {

    return this.info.remoteAddress;
});

// Toolkit decoration
server.decorate('toolkit', 'success', function (this: ResponseToolkit, data: object) {

    return this.response(data).code(200);
});

// Server decoration
server.decorate('server', 'getUptime', function (this: Server) {

    return Date.now() - this.info.started;
});
```


### Decoration Targets

| Target      | `this` Binding    | Decorates            |
| ----------- | ----------------- | -------------------- |
| `'request'` | `Request`         | `request.*`          |
| `'toolkit'` | `ResponseToolkit` | `h.*`                |
| `'server'`  | `Server`          | `server.*`           |
| `'handler'` | N/A               | Custom handler types |


### Options

- `apply` — when `type` is `'request'`, if `true`, the function is called with the request object and the return value becomes the decoration. Useful for computed properties.
- `extend` — if `true`, overrides an existing decoration. The function receives the previous value and must return the new one. Cannot be used with `'handler'`.


### Reserved Property Names

Each target has reserved names that cannot be decorated. Attempting to use them causes a TypeScript error. For example, `'request'` reserves `server`, `url`, `query`, `path`, `method`, `payload`, `params`, `auth`, `headers`, `state`, `route`, `pre`, `response`, `info`, `orig`, `app`, `plugins`, `log`, `logs`, and other internal keys.


## Route Configuration


### RouteApp

Type the `options.app` property on routes:

```typescript
interface AdminRefs {
    RouteApp: { requiredRole: string };
}

const route: ServerRoute<AdminRefs> = {
    method: 'GET',
    path: '/admin',
    options: {
        app: { requiredRole: 'admin' },
        handler: (request, h) => {

            const role: string = request.route.settings.app!.requiredRole;
            return { role };
        }
    }
};
```


### Pre-handlers with `Pres`

The `Pres` key types the `request.pre` object. Pre-handler results are assigned via the `assign` property.

```typescript
interface MyRefs {
    Params: { id: string };
    Pres: { user: { name: string; email: string } };
}

const route: ServerRoute<MyRefs> = {
    method: 'GET',
    path: '/users/{id}',
    options: {
        pre: [
            {
                method: async (request, h) => {

                    return { name: 'Test', email: 'test@example.com' };
                },
                assign: 'user'
            }
        ],
        handler: (request, h) => {

            const userName: string = request.pre.user.name;
            return { userName };
        }
    }
};
```


### Rules

Type custom route rules via the `Rules` ref key:

```typescript
interface MyRules {
    mapTo: string;
}

interface MyRefs {
    Rules: MyRules;
}

const route: ServerRoute<MyRefs> = {
    method: 'GET',
    path: '/mapped',
    rules: { mapTo: '/other' },
    handler: (request, h) => 'ok'
};
```


### Extension Points

Route-level extension points use the `ext` option:

```typescript
const route: ServerRoute = {
    method: 'GET',
    path: '/',
    options: {
        ext: {
            onPreHandler: {
                method: (request, h) => {

                    request.log(['info'], 'pre-handler');
                    return h.continue;
                }
            }
        },
        handler: (request, h) => 'ok'
    }
};
```


## Lifecycle Types


### `Lifecycle.Method<Refs>`

The signature for all lifecycle methods (handlers, extensions, pre-handlers, failActions):

```typescript
type Method<Refs> = (
    this: MergeRefs<Refs>['Bind'],
    request: Request<Refs>,
    h: ResponseToolkit<Refs>,
    err?: Error
) => ReturnValue<Refs>;
```

The `this` binding comes from the `Bind` ref key or `server.bind()`.


### `Lifecycle.ReturnValue`

All accepted return types from lifecycle methods:

- `null`, `string`, `number`, `boolean`
- `Buffer`
- `Error` or `Boom`
- `Stream`
- `object` or `object[]`
- `symbol` (toolkit signals: `h.continue`, `h.abandon`, `h.close`)
- `Auth` (from `h.authenticated()`)
- A `Promise` resolving to any of the above


### `Lifecycle.FailAction`

Error handling modes for validation failures, payload parsing errors, etc:

- `'error'` — return the error as the response
- `'log'` — log the error, continue processing
- `'ignore'` — take no action, continue processing
- A lifecycle method with signature `(request, h, err) => ...`


### `Bind` Ref Key

Controls the `this` binding in lifecycle methods:

```typescript
interface MyContext {
    greeting: string;
}

interface MyRefs {
    Bind: MyContext;
}

const route: ServerRoute<MyRefs> = {
    method: 'GET',
    path: '/',
    options: {
        bind: { greeting: 'Hello' },
        handler: function (request, h) {

            return this.greeting;  // typed as MyContext
        }
    }
};
```

Note: `this` binding is ignored when the handler is an arrow function.


## Generic Helper Functions

When writing reusable functions that accept `Request` objects, use a generic parameter instead of the concrete `Request` type.

### Preferred: Generic Function

```typescript
function getAuthUser<Refs extends ReqRef>(req: Request<Refs>) {

    return req.auth.credentials.user;
}
```

This accepts `Request` with any refs — both `Request` (defaults) and `Request<{ Params: { id: string } }>`.


### Why Not `Request` (No Generic)?

```typescript
function getAuthUser(req: Request) {

    return req.auth.credentials.user;
}
```

This only accepts `Request<ReqRefDefaults>`. If you call it with `Request<{ Params: { id: string } }>`, TypeScript will report an error because the generic parameter is checked invariantly (see [Known Limitations](#known-limitations--workarounds)).


### Bridging Example

```typescript
import { ReqRef, Request } from '@hapi/hapi';

// Generic: accepts Request with any refs
function extractToken<Refs extends ReqRef>(req: Request<Refs>): string | undefined {

    const auth = req.headers['authorization'];
    if (typeof auth === 'string') {
        return auth.replace('Bearer ', '');
    }

    return undefined;
}

// Works with any route's request
const route: ServerRoute<{ Params: { id: string } }> = {
    method: 'GET',
    path: '/users/{id}',
    handler: (request, h) => {

        const token = extractToken(request); // works
        return { id: request.params.id, token };
    }
};
```


## Known Limitations & Workarounds


### Request Invariance

`Request<CustomRefs>` is not assignable to `Request<ReqRefDefaults>`. This is a TypeScript structural typing limitation — because `Request` uses its generic parameter in both covariant (return types) and contravariant (method parameters like lifecycle methods) positions, TypeScript treats it invariantly.

**Workaround:** Use generic functions instead of concrete `Request`:

```typescript
// Won't work with Request<CustomRefs>
function bad(req: Request) { ... }

// Works with any Request<Refs>
function good<Refs extends ReqRef>(req: Request<Refs>) { ... }
```


### `Pres` Typing Default

The `Pres` default is `Record<string, any>`. Without an explicit `Pres` override in your refs, `request.pre` allows any string key access. If you want strict pre-handler typing, always provide the `Pres` key:

```typescript
interface StrictRefs {
    Pres: { user: UserObject; permissions: string[] };
}
```


### Avoiding `any` Leakage

Some defaults use `any` (like `Pres: Record<string, any>`). To keep your code strict:

1. Always provide explicit refs for `Pres` when using pre-handlers
2. Override `Payload` when parsing JSON bodies — the default includes `object` which is broad
3. Use `ReqRefDefaults` augmentation to tighten defaults globally when possible
