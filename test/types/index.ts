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
    ServerRegisterPluginObject
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