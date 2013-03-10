// Load modules

var Lab = require('lab');
var Querystring = require('querystring');
var Hapi = require('../..');
var Validation = require('../../lib/validation');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;

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
        var routeClone = Hapi.utils.clone(route);

        return {
            url: {
                search: '?' + qstr,
                query: query,
                pathname: routeClone.path,
                path: routeClone.path + '?' + qstr,//'/config?choices=1&choices=2',
                href: routeClone.path + '?' + qstr //'/config?choices=1&choices=2'
            },
            query: query,
            payload: payload,
            path: routeClone.path,
            method: routeClone.method,
            _timestamp: Date.now(),
            route: routeClone.config,
            response: { result: {} }
        };
    };

    var createRequestObjectFromPath = function (path, params, route) {

        var routeClone = Hapi.utils.clone(route);

        return {
            url: {
                pathname: path,
                path: path,
                href: path
            },
            params: params,
            method: routeClone.method,
            _timestamp: Date.now(),
            route: routeClone.config,
            response: { result: {} }
        };
    };

    describe('#response', function () {

        var route = { method: 'GET', path: '/', config: { handler: testHandler, response: { schema: { username: S().required() } } } };

        it('should not raise an error when responding with valid param', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);

            request.response = Hapi.Response.generate({ username: 'test' });

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('an error response should skip response validation and not return an error', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);

            request.response = Hapi.Response.generate(Hapi.error.unauthorized('You are not authorized'));

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with invalid param', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.response = Hapi.Response.generate({ wrongParam: 'test' });

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('should not raise an error when responding with invalid param and sample is 0', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.sample = 0;
            request.response = Hapi.Response.generate({ wrongParam: 'test' });

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('should raise an error when responding with invalid param and sample is 100', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.sample = 100;
            request.response = Hapi.Response.generate({ wrongParam: 'test' });

            Validation.response(request, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        internals.calculateFailAverage = function (size, sample) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.failAction = 'log';
            request.route.response.sample = sample;
            request.response = Hapi.Response.generate({ wrongParam: 'test' });
            var failureCount = 0;

            request.log = function () {

                failureCount++;
            };

            var validationResponse = function () {};

            for (var i = size; i > 0; i--) {
                Validation.response(request, validationResponse);
            }

            return (failureCount / size) * 100;
        };

        it('sample percentage results in correct fail rate', function (done) {

            var rates = [];

            for (var i = 50; i > 0; i--) {                                  // Try 50 times and take the max and min
                rates.push(internals.calculateFailAverage(100, 25));
            }

            rates = rates.sort(function (a, b) {

                return a - b;
            });

            expect(rates[0]).to.be.greaterThan(8);                          // accept a 15 point margin
            expect(rates[49]).to.be.lessThan(43);

            done();
        });

        it('should report an error when responding with invalid response param and failAction is report', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.route.response.failAction = 'log';
            request.response = Hapi.Response.generate({ wrongParam: 'test' });

            request.log = function (tags, data) {

                expect(data).to.contain('the key (wrongParam) is not allowed');
                done();
            };

            Validation.response(request, function (err) {

                expect(err).to.not.exist;
            });
        });

        it('should raise an error when validating a non-object response', function (done) {

            var query = { username: 'steve' };
            var request = createRequestObject(query, route);
            request.response = Hapi.Response.generate('test');

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

            var request = createRequestObjectFromPath('/test', { id: 'test', something: true }, route);

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