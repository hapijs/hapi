// Note: Make sure to 'npm install bcrypt hawk hapi-auth-basic hapi-auth-hawk' first

// Load modules

var Hawk = require('hawk');
var Bcrypt = require('bcrypt');
var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.users = {
    john: {
        user: 'john'
    }
};


internals.passwords = {
    john: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm'            // password: secret
};


internals.credentials = {
    'john': {
        id: 'john',
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
};


internals.validate = function (username, password, callback) {

    Bcrypt.compare(password, internals.passwords[username], function (err, isValid) {

        callback(null, isValid, internals.users[username]);
    });
};


internals.getCredentials = function (id, callback) {

    callback(null, internals.credentials[id]);
};


internals.hawkHeader = function (id, path, server) {

    if (internals.credentials[id]) {
        return Hawk.client.header(server.info.uri + path, 'GET', { credentials: internals.credentials[id] }).field;
    }
    else {
        return '';
    }
};

internals.handler = function (request, reply) {

    reply('Success');
};


internals.main = function () {

    var server = new Hapi.Server(8000);
    server.pack.require(['hapi-auth-basic', 'hapi-auth-hawk'], function (err) {

        server.auth.strategy('hawk', 'hawk', { getCredentialsFunc: internals.getCredentials });
        server.auth.strategy('basic', 'basic', { validateFunc: internals.validate });

        server.route([
            { method: 'GET', path: '/basic', config: { handler: internals.handler, auth: { strategies: ['basic'] } } },
            { method: 'GET', path: '/hawk', config: { handler: internals.handler, auth: { strategies: ['hawk'] } } },
            { method: 'GET', path: '/multiple', config: { handler: internals.handler, auth: { strategies: ['basic', 'hawk'] } } }
        ]);

        server.start(function () {

            console.log('\nBasic request to /basic:');
            console.log('curl ' + server.info.uri + '/basic -H "Authorization: Basic ' + (new Buffer('john:secret', 'utf8')).toString('base64') + '"');
            console.log('\nHawk request to /hawk:');
            console.log('curl ' + server.info.uri + '/hawk -H \'Authorization: ' + internals.hawkHeader('john', '/hawk', server) + '\'');
            console.log('\nBasic request to /multiple:');
            console.log('curl ' + server.info.uri + '/multiple -H "Authorization: Basic ' + (new Buffer('john:secret', 'utf8')).toString('base64') + '"');
            console.log('\nHawk request to /multiple:');
            console.log('curl ' + server.info.uri + '/multiple -H \'Authorization: ' + internals.hawkHeader('john', '/multiple', server) + '\'');
        });
    });
};


internals.main();