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

const server = createServer();
check.type<Server>(server);

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
    register: function (server, options) {

        check.type<TestPluginOptions>(options);
        
        server.expose({
            add: function (a: number, b: number) {

                return a + b + options.x;
            }
        });
    }
};

await server.register({ plugin, options: { x: 10 } });

const sum = server.plugins.test.add(1, 2);
expect(sum).to.equal(13);
check.type<number>(sum);
