import {
    Plugin,
    Request,
    ResponseToolkit,
    Server,
    ServerRoute,
    server as createServer
} from '../..';

import * as Lab from '@hapi/lab';
import { expect } from '@hapi/code';

const { expect: check } = Lab.types;

declare module '../..' {
    interface PluginProperties {
        test: {
            add(a: number, b: number): number;
        };
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

const route: ServerRoute = {
    method: 'GET',
    path: '/',
    handler: (request: Request, h: ResponseToolkit) => 'hello!'
};

server.route(route);

interface TestPluginOptions {
    x: number;
}

const plugin: Plugin<TestPluginOptions> = {
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

await server.register({ plugin, options: { x: 10 } });

const sum = server.plugins.test.add(1, 2);
expect(sum).to.equal(130);
check.type<number>(sum);
