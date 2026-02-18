import { types as lab } from '@hapi/lab';
import { expect } from '@hapi/code';
import * as CatboxMemory from '@hapi/catbox-memory';

import {
    Plugin,
    ReqRef,
    Request,
    RequestRoute,
    ResponseToolkit,
    Server,
    ServerRoute,
    server as createServer,
    UserCredentials,
    ServerRegisterPluginObject,
    Lifecycle,
    CachedServerMethod
} from '../..';

const { expect: check } = lab;

type IsAny<T> = (
    unknown extends T
      ? [keyof T] extends [never] ? false : true
      : false
  );


declare module '../..' {
    interface UserCredentials {
        someId: string;
        someName: string;
    }
}

interface ServerAppSpace {
    multi?: number;
}

type MyServer = Server<ServerAppSpace>;

const server = createServer<ServerAppSpace>();
check.type<Server>(server);
check.type<MyServer>(server);

server.app.multi = 10;

const genericRoute: ServerRoute = {
    method: 'GET',
    path: '/',
    handler: (request, h) => {

        check.type<UserCredentials>(request.auth.credentials!.user!);

        const y: IsAny<typeof request.auth.credentials> = false;

        return 'hello!';
    }
}

server.route(genericRoute);

interface RequestDecorations {
    Server: MyServer;
    RequestApp: {
        word: string;
    },
    RouteApp: {
        prefix: string[];
    },
    AuthUser: {
        id: string;
        name: string;
        email: string;
    },
    AuthCredentialsExtra: {
        test: number;
    },
    AuthApp: {
        key: string;
        name: string;
    },
    AuthArtifactsExtra: {
        some: string;
        thing: number;
    }
}

type AppRequest = Request<RequestDecorations>;

const route: ServerRoute<RequestDecorations> = {
    method: 'POST',
    path: '/',
    options: {
        app: {
            prefix: ['xx-']
        },
        payload: {
            maxParts: 100,
            maxBytes: 1024 * 1024,
            output: 'stream',
            multipart: true
        }
    },
    handler: (request: AppRequest, h: ResponseToolkit) => {

        request.app.word = 'x';

        check.type<Record<string, string>>(request.params);
        check.type<number>(request.server.app.multi!);
        check.type<string[]>(request.route.settings.app!.prefix);

        check.type<number>(request.auth.credentials!.test);

        check.type<string>(request.auth.credentials!.user!.email);
        check.type<string>(request.auth.credentials!.user!.id);
        check.type<string>(request.auth.credentials!.user!.name);

        check.type<string>(request.auth.credentials!.app!.name);
        check.type<string>(request.auth.credentials!.app!.key);

        check.type<string>(request.auth.artifacts.some);
        check.type<number>(request.auth.artifacts.thing);

        const y: IsAny<typeof request.auth.credentials> = false;
        const z: IsAny<typeof request.auth.artifacts> = false;

        return 'hello!'
    }
};

server.route(route);

interface TestPluginOptions {
    x: number;
}

interface TestPluginDecorations {
    plugins: {
        test: {
            add(a: number, b: number): number;
        };
    }
}

const plugin: Plugin<TestPluginOptions, TestPluginDecorations> = {
    name: 'test',
    version: '1.0.0',
    register: function (srv: MyServer, options) {

        check.type<TestPluginOptions>(options);

        srv.expose({
            add: function (a: number, b: number) {

                return (a + b + options.x) * srv.app.multi!;
            }
        });
    }
};

const loadedServer = await server.register({ plugin, options: { x: 10 } });

check.type<RequestRoute | null>(server.match('GET', '/'));
check.type<RequestRoute | null>(server.match('get', '/'));

const sum = loadedServer.plugins.test.add(1, 2);
expect(sum).to.equal(130);
check.type<number>(sum);

server.cache.provision({
    name: 'some-cache',
    provider: {
        constructor: CatboxMemory.Engine,
        options: {
            partition: 'test'
        }
    }
})

declare module '../..' {
    interface ServerMethods {
        test: {
            add: CachedServerMethod<((a: number, b: number) => number)>;
        }
    }
}

server.method('test.add', (a: number, b: number) => a + b, {
    bind: server,
    cache: {
        expiresIn: 1000,
        generateTimeout: 100,
        cache: 'some-cache',
        segment: 'test-segment',
    },
    generateKey: (a: number, b: number) => `${a}${b}`
});

server.methods.test.add.cache?.drop(1, 2);

declare module '../..' {
    interface Request {
        obj1: {
            func1(a: number, b: number): number;
        };

        func2: (a: number, b: number) => number;
    }

    interface ResponseToolkit {
        obj2: {
            func3(a: number, b: number): number;
        };

        func4: (a: number, b: number) => number;
    }

    interface Server {
        obj3: {
            func5(a: number, b: number): number;
        };

        func6: (a: number, b: number) => number;
    }
}

const theFunc = (a: number, b: number) => a + b;
const theLifecycleMethod: Lifecycle.Method = () => 'ok';

// Error when decorating existing properties
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('request', 'payload', theFunc));
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('toolkit', 'state', theFunc));
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('server', 'dependency', theFunc));
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('server', 'dependency', theFunc));

server.decorate('handler', 'func1_1', () => theLifecycleMethod);
server.decorate('handler', 'func1_2', () => theLifecycleMethod, { apply: true });

// Error when extending on handler
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('handler', 'func1_3', () => theLifecycleMethod, { apply: true, extend: true }));

// Error when handler does not return a lifecycle method
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('handler', 'func1_4', theFunc));

// Decorating request with functions
server.decorate('request', 'func2_1', theFunc);
server.decorate('request', 'func2_1', () => theFunc, { apply: true, extend: true });
server.decorate('request', 'func2_2', theFunc, { apply: true });
server.decorate('request', 'func2_2', theFunc, { extend: true });

// Decorating toolkit with functions
server.decorate('toolkit', 'func4_1', theFunc);
server.decorate('toolkit', 'func4_1', theFunc, { apply: true, extend: true });
server.decorate('toolkit', 'func4_2', theFunc, { apply: true });
server.decorate('toolkit', 'func4_2', theFunc, { extend: true });

// Decorating server with functions
server.decorate('server', 'func6_1', theFunc);
server.decorate('server', 'func6_1', theFunc, { apply: true, extend: true });
server.decorate('server', 'func6_2', theFunc, { apply: true });
server.decorate('server', 'func6_2', theFunc, { extend: true });

// Decorating request with objects
server.decorate('request', 'obj1_1', { func1: theFunc });

// Type error when extending on request with objects
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('request', 'obj1_1', { func1: theFunc }, { apply: true, extend: true }));


// Decorating toolkit with objects
server.decorate('toolkit', 'obj2_1', { func3: theFunc });

// Error when extending on toolkit with objects
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('toolkit', 'obj2_1', { func3: theFunc }, { apply: true, extend: true }));

// Decorating server with objects
server.decorate('server', 'obj3_1', { func5: theFunc });

// Error when extending on server with objects
// @ts-expect-error Lab does not support overload errors
check.error(() => server.decorate('server', 'obj3_1', { func5: theFunc }, { apply: true, extend: true }));

// Issue #4561 - Generic Request<Refs> should resolve augmented ReqRefDefaults auth properties

interface ExtraCred {
    extra_id: string;
}

interface UserProfile {
    id: string;
}

declare module '../..' {
    interface ReqRefDefaults {
        AuthCredentialsExtra: Partial<ExtraCred>;
    }
}

// Generic route (no custom refs) should see augmented UserCredentials
const genericAuthRoute: ServerRoute = {
    method: 'GET',
    path: '/auth-check',
    handler: (request, h) => {

        check.type<string>(request.auth.credentials.user!.someId);
        check.type<string>(request.auth.credentials.user!.someName);

        const credIsAny: IsAny<typeof request.auth.credentials> = false;

        return 'ok';
    }
};

// Generic function should see augmented credentials from ReqRefDefaults
export function processAuthGeneric<Refs extends ReqRef>(req: Request<Refs>): void {

    if (req.auth.isAuthenticated && req.auth.credentials.extra_id) {
        check.type<string | undefined>(req.auth.credentials.extra_id);
    }
}

// Non-generic Request should also see augmented credentials
export function processAuthConcrete(req: Request): void {

    if (req.auth.isAuthenticated && req.auth.credentials.extra_id) {
        check.type<string | undefined>(req.auth.credentials.extra_id);
    }

    // credentials should NOT resolve to `any`
    const credIsAny: IsAny<typeof req.auth.credentials> = false;
    const artifactsIsAny: IsAny<typeof req.auth.artifacts> = false;
}

// Generic function should accept Request with specific route refs
interface SpecificRouteRefs {
    Params: { id: string };
}

export function callWithSpecificRefs(req: Request<SpecificRouteRefs>): void {

    processAuthGeneric(req);
}

// =============================================================================
// ReqRef System Issue Tests
// Each section demonstrates a specific weakness in the current type system.
// These tests produce VISIBLE compiler errors to demonstrate each problem.
// =============================================================================

// -----------------------------------------------------------------------------
// ISSUE 1: Direct Refs['Key'] access bypasses MergeRefs (route.d.ts:361)
//
// RouteOptionsPreObject.assign uses `keyof Refs['Pres']` instead of
// `keyof MergeRefs<Refs>['Pres']`. When the user doesn't explicitly provide
// `Pres` in their Refs, `Refs['Pres']` is `unknown` (from ReqRef's
// Partial<Record<..., unknown>>), so `keyof unknown` is `never`.
// This means `assign` is impossible unless Pres is explicitly provided.
// -----------------------------------------------------------------------------

// This should compile — the user only customizes Params, and the default
// Pres (Record<string, any>) should allow any string for `assign`.
// ERROR: Type '"user"' is not assignable to type 'never'.
const issuePreAssign: ServerRoute<{ Params: { id: string } }> = {
    method: 'GET',
    path: '/users/{id}',
    options: {
        pre: [
            {
                method: (request, h) => ({ name: 'test' }),
                assign: 'user'                                  // TS ERROR — should work
            }
        ],
        handler: (request, h) => 'ok'
    }
};

// -----------------------------------------------------------------------------
// ISSUE 2: Params defaults to Record<string, any> — allows unsafe access
//
// URL path params are ALWAYS strings at runtime (before Joi validation), but
// the default type Record<string, any> means TypeScript allows anything.
// These assignments should all be errors but none are.
// -----------------------------------------------------------------------------

const issueParamsAny: ServerRoute = {
    method: 'GET',
    path: '/items/{id}',
    handler: (request, h) => {

        // FIXED: Params now correctly typed as Record<string, string>
        // @ts-expect-error - params are strings, not numbers
        const id: number = request.params.id;
        // @ts-expect-error - params are strings, not boolean[]
        const wat: boolean[] = request.params.id;

        // FIXED: params is no longer `any`
        const paramsIsAny: IsAny<typeof request.params.id> = false;

        return 'ok';
    }
};

// -----------------------------------------------------------------------------
// ISSUE 3: Headers defaults to Record<string, any>
//
// Node's http.IncomingHttpHeaders types headers as string | string[] | undefined.
// The Record<string, any> default loses this.
// -----------------------------------------------------------------------------

const issueHeadersAny: ServerRoute = {
    method: 'GET',
    path: '/headers',
    handler: (request, h) => {

        // FIXED: Headers now correctly typed as Record<string, string | string[] | undefined>
        // @ts-expect-error - headers are string | string[] | undefined, not number
        const auth: number = request.headers.authorization;

        // FIXED: headers is no longer `any`
        const headersIsAny: IsAny<typeof request.headers.authorization> = false;

        return 'ok';
    }
};

// -----------------------------------------------------------------------------
// ISSUE 4: Default RequestQuery has [key: string]: any index signature
//
// Without a Query override, any access on request.query is `any`.
// -----------------------------------------------------------------------------

const issueQueryAny: ServerRoute = {
    method: 'GET',
    path: '/search',
    handler: (request, h) => {

        // FIXED: Query now correctly typed as Record<string, string | string[] | undefined>
        // @ts-expect-error - query values are string | string[] | undefined, not number
        const page: number = request.query.page;
        // @ts-expect-error - query values are string | string[] | undefined, not boolean[]
        const wat: boolean[] = request.query.anything;

        // FIXED: query is no longer `any`
        const queryIsAny: IsAny<typeof request.query.page> = false;

        return 'ok';
    }
};

// -----------------------------------------------------------------------------
// ISSUE 5: Request<CustomRefs> not assignable to Request<ReqRefDefaults>
//
// A function taking Request (no generic) can't accept Request<{ Params: ... }>
// even though the custom refs only NARROW a property. Users are forced to
// choose between generic (accepts all) or concrete (sees defaults).
// -----------------------------------------------------------------------------

export function concreteHelper(req: Request): string | undefined {

    if (req.auth.credentials.extra_id) {
        return req.auth.credentials.extra_id;
    }

    return undefined;
}

interface MyRouteRefs {
    Params: { id: string };
    Query: { expand: string };
}

// KNOWN LIMITATION: Request<MyRouteRefs> is not assignable to Request<ReqRefDefaults>
// because TypeScript checks generic interface compatibility invariantly when
// the generic appears in contravariant positions (e.g. lifecycle method parameters).
// Workaround: use a generic function like processAuthGeneric<Refs> above instead
// of concrete Request (no generic) for helper functions that need to accept
// requests with different Refs.
export function issueConcreteVsGeneric(req: Request<MyRouteRefs>): void {

    // @ts-expect-error - Known TS limitation: Request<CustomRefs> not assignable to Request<ReqRefDefaults>
    concreteHelper(req);
}

// -----------------------------------------------------------------------------
// ISSUE 6: state and preResponses are not extensible through ReqRef
//
// These properties use hardcoded Record<string, any> and are NOT wired
// through InternalRequestDefaults/ReqRef, so users can't type them.
// -----------------------------------------------------------------------------

const issueStateAny: ServerRoute = {
    method: 'GET',
    path: '/state',
    handler: (request, h) => {

        // FIXED: state is now Record<string, unknown> — requires type narrowing
        // @ts-expect-error - state values are unknown, not directly assignable to number
        const session: number = request.state.session;

        // FIXED: state is no longer `any`
        const stateIsAny: IsAny<typeof request.state.session> = false;

        // FIXED: preResponses is no longer `any`
        const preRespIsAny: IsAny<typeof request.preResponses.myPre> = false;

        return 'ok';
    }
};
