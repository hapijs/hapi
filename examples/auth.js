// Load modules

var Crypto = require('crypto');
var Hawk = require('hawk');
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


internals.credentials = {
    'john': {
        id: 'john',
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    }
};


internals.loadUser = function (username, callback) {

    callback(null, internals.users[username]);
};


internals.getCredentials = function (id, callback) {

    callback(null, internals.credentials[id]);
};


internals.hawkHeader = function (id, path, server) {

    if (internals.credentials[id]) {
        return Hawk.getAuthorizationHeader('http://' + server.settings.host + ':' + server.settings.port + path, 'GET', { credentials: internals.credentials[id] });
    }
    else {
        return '';
    }
};

internals.handler = function (request) {

    request.reply('Success');
};


internals.main = function () {

    var config = {
        auth: {
            'default': {
                scheme: 'basic',
                loadUserFunc: internals.loadUser,
                hashPasswordFunc: internals.hashPassword
            },
            'hawk': {
                scheme: 'hawk',
                getCredentialsFunc: internals.getCredentials
            },
            'basic': {
                scheme: 'basic',
                loadUserFunc: internals.loadUser,
                hashPasswordFunc: internals.hashPassword
            }
        }
    };

    var http = new Hapi.Server(0, config);

    http.route([
        { method: 'GET', path: '/basic', config: { handler: internals.handler, auth: { strategies: ['basic'] } } },
        { method: 'GET', path: '/hawk', config: { handler: internals.handler, auth: { strategies: ['hawk'] } } },
        { method: 'GET', path: '/multiple', config: { handler: internals.handler, auth: { strategies: ['basic', 'hawk'] } } }
    ]);

    http.start(function () {

        console.log('\nBasic request to /basic:');
        console.log('curl ' + http.settings.uri + '/basic -H "Authorization: Basic ' + (new Buffer('john:john', 'utf8')).toString('base64') + '"');
        console.log('\nHawk request to /hawk:');
        console.log('curl ' + http.settings.uri + '/hawk -H \'Authorization: ' + internals.hawkHeader('john', '/hawk', http) + '\'');
        console.log('\nBasic request to /multiple:');
        console.log('curl ' + http.settings.uri + '/multiple -H "Authorization: Basic ' + (new Buffer('john:john', 'utf8')).toString('base64') + '"');
        console.log('\nHawk request to /multiple:');
        console.log('curl ' + http.settings.uri + '/multiple -H \'Authorization: ' + internals.hawkHeader('john', '/multiple', http) + '\'');
    });
};


internals.main();