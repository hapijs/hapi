// Load modules

var Crypto = require('crypto');
var Hapi = require('../lib');


// Declare internals

var internals = {
    salt: '' + Date.now()
};


internals.hashPassword = function (password) {

    var hash = Crypto.createHash('sha256');
    hash.update(password);
    hash.update(internals.salt);

    return hash.digest('base64');
};


internals.users = {
    john: {
        id: 'john',
        password: internals.hashPassword('john')
    }
};


internals.validateCookie = function (session, callback) {

    var password = internals.users[session.id].password;

    callback(password === session.password ? null : new Error('Invalid credentials'), null);
};


internals.handler = function (request) {

    request.reply('Success');
};


internals.loginHandler = function (request) {

    request.auth.session.set(internals.users.john);
    request.reply('Success');
};


internals.main = function () {

    var config = {
        auth: {
            scheme: 'cookie',
            password: 'secret',
            ttl: 60 * 1000,                 // Expire after a minute
            cookie: 'sid',                  // Cookie name
            clearInvalid: true,
            validateFunc: internals.validateCookie
        }
    };

    var http = new Hapi.Server(0, config);

    http.route([
        { method: 'GET', path: '/', config: { handler: internals.handler, auth: { strategies: ['default'] } } },
        { method: 'GET', path: '/login', config: { handler: internals.loginHandler, auth: false } }
    ]);

    http.start(function () {

        console.log('\nLogin with the following command');
        console.log('curl ' + http.settings.uri + '/login -I');
        console.log('\nCopy the Set-Cookie value up until the ;');
        console.log('\nAuthenticate request to /:');
        console.log('curl ' + http.settings.uri + '/ -H \"Cookie: [paste cookie value here]"');
    });
};


internals.main();