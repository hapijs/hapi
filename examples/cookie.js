// Load modules

var Hapi = require('../lib');


// Declare internals

var internals = {};


internals.users = {
    john: {
        id: 'john',
        password: 'password',
        name: 'John Doe'
    }
};


internals.validateCookie = function (session, callback) {

    // Validate session if needed to ensure session is still valid

    callback(null, null);
};


internals.home = function (request) {

    request.reply('<html><head><title>Login page</title></head><body><h3>Welcome ' + request.auth.credentials.name + '!</h3><br/><form method="get" action="/logout"><input type="submit" value="Logout"></form></body></html>');
};


internals.login = function (request) {

    if (request.auth.isAuthenticated) {
        return request.reply.redirect('/').send();
    }

    var message = '';
    var account = null;

    if (request.method === 'post') {
        
        if (!request.payload.username ||
            !request.payload.password) {

            message = 'Missing username or password';
        }
        else {
            account = internals.users[request.payload.username];
            if (!account ||
                account.password !== request.payload.password) {

                message = 'Invalid username or password';
            }
        }
    }

    if (request.method === 'get' ||
        message) {

        return request.reply('<html><head><title>Login page</title></head><body>' + (message ? '<h3>' + message + '</h3><br/>' : '') + '<form method="post" action="/login">Username: <input type="text" name="username"><br>Password: <input type="password" name="password"><br/><input type="submit" value="Login"></form></body></html>');
    }

    request.auth.session.set(account);
    return request.reply.redirect('/').send();
};


internals.logout = function (request) {

    request.auth.session.clear();
    return request.reply.redirect('/').send();
};


internals.main = function () {

    var config = {
        auth: {
            scheme: 'cookie',
            password: 'secret',
            ttl: 60 * 1000,                 // Expire after a minute
            cookie: 'sid',                  // Cookie name
            clearInvalid: true,
            validateFunc: internals.validateCookie,
            redirectTo: '/login',
            allowInsecure: true
        },
        state: {
            cookies: {
                clearInvalid: true
            }
        }
    };

    var http = new Hapi.Server('localhost', 8000, config);

    http.route([
        { method: 'GET', path: '/', config: { handler: internals.home, auth: true } },
        { method: 'GET', path: '/login', config: { handler: internals.login, auth: { mode: 'try' } } },
        { method: 'POST', path: '/login', config: { handler: internals.login, auth: { mode: 'try' } } },
        { method: 'GET', path: '/logout', config: { handler: internals.logout, auth: true } }
    ]);

    http.start();
};


internals.main();