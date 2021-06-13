'use strict';

const Hapi = require('./');

const main = async () => {

    const logger = {
        level: 'debug',
        logger: 'pino'
    };
    const server = new Hapi.Server({ port: 8080, logger });

    server.route({ method: 'GET', path: '/', handler: () => 'success' });
    server.route({ method: 'GET', path: '/err', handler: () => new Error('foo') });
    await server.start();
};

main();
