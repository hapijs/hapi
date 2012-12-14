// Load modules

var Chai = require('chai');
var Querystring = require('querystring');
var Hapi = require('../helpers');
var Validation = process.env.TEST_COV ? require('../../lib-cov/validation') : require('../../lib/validation');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;

var S = Hapi.types.String,
    N = Hapi.types.Number,
    O = Hapi.types.Object,
    B = Hapi.types.Boolean;


describe('Validation', function () {

    var testHandler = function (hapi, reply) {

        reply('ohai');
    };

    var createRequestObject = function (query, route, payload) {

        var qstr = Querystring.stringify(query);

        return {
            url: {
                search: '?' + qstr,
                query: query,
                pathname: route.path,
                path: route.path + '?' + qstr,//'/config?choices=1&choices=2',
                href: route.path + '?' + qstr //'/config?choices=1&choices=2'
            },
            query: query,
            payload: payload,
            path: route.path,
            method: route.method,
            _route: { config: route.config },
            response: { result: {} }
        };
    };

    var createRequestObjectFromPath = function (path, params, route) {

        return {
            url: {
                pathname: path,
                path: path,
                href: path
            },
            params: params,
            method: route.method,
            _route: { config: route.config },
            response: { result: {} }
        };
    };

    describe('#response', function () {

        var route = { method: 'GET', path: '/', config: { handler: testHandler, response: { username: S().required() } } };

        it('should not raise an error when responding with valid param', function (done) {

            var query = { username: 'walmart' };
            var request = createRequestObject(query, route);

            request._response = Hapi.Response.generate({ username: 'test' });

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding without invalid param', function (done) {

            var query = { username: 'walmart' };
            var request = createRequestObject(query, route);

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('should raise an error when validating a non-object response', function (done) {

            var query = { username: 'walmart' };
            var request = createRequestObject(query, route);
            request._response = Hapi.Response.generate('test');

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('doesn\'t perform validation when response is true', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, response: true } };

            var query = null;
            var request = createRequestObject(query, route);

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });
    });

    describe('#path', function () {

        var route = { method: 'GET', path: '/{id}', config: { handler: testHandler, validate: { path: { id: N().required() } } } };

        it('should not raise an error when responding with valid param in the path', function (done) {

            var request = createRequestObjectFromPath('/21', { id: 21 }, route);

            Validation.path(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid path param', function (done) {

            var request = createRequestObjectFromPath('/test', { id: 'test' }, route);

            Validation.path(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('doesn\'t perform validation when path is true', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { path: true } } };

            var query = null;
            var request = createRequestObject(query, route);

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });
    });

    describe('#query', function () {

        it('doesn\'t perform validation when query is true', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { query: true } } };

            var query = null;
            var request = createRequestObject(query, route);

            Validation.query(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should not raise an error when responding with valid param in the querystring', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { query: { username: S().min(7)  } } } };
            var query = { username: 'username' };
            var request = createRequestObject(query, route);

            Validation.query(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid querystring param', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { query: { username: S().min(7) } } } };
            var query = { username: '1' };
            var request = createRequestObject(query, route);

            Validation.query(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    describe('#payload', function () {

        it('doesn\'t perform validation when schema is true', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { schema: true } } };

            var payload = null;
            var request = createRequestObject(null, route, payload);

            Validation.payload(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should not raise an error when responding with valid param in the payload', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { schema: { username: S().min(7)  } } } };
            var payload = { username: 'username' };
            var request = createRequestObject(null, route, payload);

            Validation.payload(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with an invalid payload param', function (done) {

            var route = { method: 'GET', path: '/', config: { handler: testHandler, validate: { schema: { username: S().required() } } } };
            var payload = { username: '' };
            var request = createRequestObject(null, route, payload);

            Validation.payload(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });
});