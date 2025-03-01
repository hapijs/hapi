import { types as lab } from '@hapi/lab';
import { expect } from '@hapi/code';
import * as CatboxMemory from '@hapi/catbox-memory';

import {
    Plugin,
    Request,
    RequestRoute,
    ResponseToolkit,
    Server,
    ServerRoute,
    server as createServer,
    ServerRegisterPluginObject,
    Lifecycle
} from '../..';

const { expect: check } = lab;

interface ServerAppSpace {
    multi?: number;
}

type MyServer = Server<ServerAppSpace>;

const server = createServer<ServerAppSpace>();
check.type<Server>(server);
check.type<MyServer>(server);

server.app.multi = 10;

interface RequestDecorations {
    Server: MyServer;
    RequestApp: {
        word: string;
    },
    RouteApp: {
        prefix: string[];
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
