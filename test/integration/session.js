// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Hapi = require(libPath + 'hapi');


describe('Session', function() {
    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18085';

    var profile1Handler = function (request) {
        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    };

    var profile2Handler = function (request) {
        request.reply({
            'id': 'ba0dbda8b1c',
            'name': 'Joe Jackson'
        });
    };

    var loadClient = function() {
        return null;
    };

    var loadUser = function() {
        return null;
    };

    var checkAuthorization = function() {
        return true;
    };

    var authentication = {
        loadClientFunc: loadClient,
        loadUserFunc: loadUser,
        extensionFunc: null,
        checkAuthorizationFunc: checkAuthorization,

        tokenEndpoint: '/oauth/token',
        defaultAlgorithm: 'hmac-sha-1',
        tokenLifetimeSec: 1209600,

        aes256Keys: {
            oauthRefresh: 'refreshtoken',
            oauthToken: 'token'
        },
        tos: {
            min: 'none'
        }
    };

    function setupServer(done) {
        _server = new Hapi.Server('0.0.0.0', 18095, { authentication: authentication });
        _server.addRoutes([
            { method: 'GET', path: '/profile1', config: { handler: profile1Handler, cache: false, auth: { mode: 'www' } } },
            { method: 'GET', path: '/profile2', config: { handler: profile2Handler, cache: false, auth: { mode: 'optional' } } }
        ]);
        _server.listener.on('listening', function() {
            done();
        });
        _server.start();
    }

    function makeRequest(path, method, payload, callback) {
        var next = function(res) {
            return callback(res);
        };

        _server.inject({
            method: method,
            url: _serverUrl + path,
            payload: payload
        }, next);
    }

    function parseHeaders(res) {

        var headersObj = {};
        var headers = res._header.split('\r\n');
        for (var i = 0, il = headers.length; i < il; i++) {
            var header = headers[i].split(':');
            var headerValue = header[1] ? header[1].trim() : '';
            headersObj[header[0]] = headerValue;
        }

        return headersObj;
    }

    before(setupServer);

    it('returns error header on response when authentication is missing', function(done) {
        makeRequest('/profile1', 'GET', null, function(rawRes) {
            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['WWW-Authenticate']).to.contain('error');
            done();
        });
    });

    it('returns endpoint data when authentication is optional', function(done) {
        makeRequest('/profile2', 'GET', null, function(rawRes) {
            expect(rawRes.result.id).to.equal('ba0dbda8b1c');
            done();
        });
    });

    describe('#tokenEndpoint', function() {

        it('returns bad request error when no grant type is specified', function(done) {
            makeRequest('/oauth/token', 'POST', null, function(rawRes) {
                expect(rawRes.result.error).to.exist;
                expect(rawRes.result.error).to.equal('invalid_request');
                done();
            });
        });

        it('returns error when no client authentication data is specified', function(done) {
            var payload = '{"grant_type": "client_credentials"}';

            makeRequest('/oauth/token', 'POST', payload, function(rawRes) {
                expect(rawRes.result.error).to.exist;
                expect(rawRes.result.error_description).to.equal('Request missing client authentication');
                done();
            });
        });
    });
});