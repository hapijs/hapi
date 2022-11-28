import { types as lab } from '@hapi/lab';
import { expect } from '@hapi/code';

import {
    Plugin,
    Request,
    ResponseToolkit,
    Server,
    ServerRoute,
    server as createServer
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
    RequestApp: {
        word: string;
    }
}

type AppRequest = Request<RequestDecorations>;

const route: ServerRoute = {
    method: 'GET',
    path: '/',
    handler: (request: AppRequest, h: ResponseToolkit) => {

        request.app.word = 'x';
        check.type<Record<string, string>>(request.params);

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

const sum = loadedServer.plugins.test.add(1, 2);
expect(sum).to.equal(130);
check.type<number>(sum);
