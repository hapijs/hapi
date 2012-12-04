// Load modules

var Chai = require('chai');
var Sinon = require('sinon');
var Async = require('async');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Batch', function () {

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18084';

    var profileHandler = function (request) {

        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    };

    var activeItemHandler = function (request) {

        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    };

    var itemHandler = function (request) {

        request.reply({
            'id': request.params.id,
            'name': 'Item'
        });
    };

    var badCharHandler = function (request) {

        request.reply({
            'id': 'test',
            'name': Date.now()
        });
    };

    var badValueHandler = function (request) {

        request.reply(null);
    };

    var fetch1 = function (request, next) {

        next('Hello');
    };

    var fetch2 = function (request, next) {

        next(request.pre.m1 + request.pre.m3 + request.pre.m4);
    };

    var fetch3 = function (request, next) {

        process.nextTick(function () {

            next(' ');
        });
    };

    var fetch4 = function (request, next) {

        next('World');
    };

    var fetch5 = function (request, next) {

        next(request.pre.m2 + '!');
    };

    var getFetch = function (request) {

        request.reply(request.pre.m5 + '\n');
    };

    var errorHandler = function (request) {

        request.reply(new Error('myerror'));
    };

    function setupServer() {

        _server = new Hapi.Server('0.0.0.0', 18084, { batch: true });
        _server.addRoutes([
            { method: 'GET', path: '/profile', handler: profileHandler },
            { method: 'GET', path: '/item', handler: activeItemHandler },
            { method: 'GET', path: '/item/{id}', handler: itemHandler },
            { method: 'GET', path: '/error', handler: errorHandler },
            { method: 'GET', path: '/badchar', handler: badCharHandler },
            { method: 'GET', path: '/badvalue', handler: badValueHandler },
            {
                method: 'GET',
                path: '/fetch',
                handler: getFetch,
                config: {
                    pre: [
                        { method: fetch1, assign: 'm1', mode: 'parallel' },
                        { method: fetch2, assign: 'm2' },
                        { method: fetch3, assign: 'm3', mode: 'parallel' },
                        { method: fetch4, assign: 'm4', mode: 'parallel' },
                        { method: fetch5, assign: 'm5' }
                    ]
                }
            }
        ]);
    }

    function makeRequest(payload, callback) {

        var next = function (res) {

            return callback(res.result);
        };

        _server.inject({
            method: 'post',
            url: _serverUrl + '/batch',
            payload: payload
        }, next);
    }

    before(setupServer);

    it('shows single response when making request for single endpoint', function (done) {

        makeRequest('{ "requests": [{ "method": "get", "path": "/profile" }] }', function (res) {

            expect(res[0].id).to.equal('fa0dbda9b1b');
            expect(res[0].name).to.equal('John Doe');
            expect(res.length).to.equal(1);
            done();
        });
    });

    it('shows two ordered responses when requesting two endpoints', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/profile"}, {"method": "get", "path": "/item"}] }', function (res) {

            expect(res[0].id).to.equal('fa0dbda9b1b');
            expect(res[0].name).to.equal('John Doe');
            expect(res.length).to.equal(2);
            expect(res[1].id).to.equal('55cf687663');
            expect(res[1].name).to.equal('Active Item');
            done();
        });
    });

    it('handles a large number of batch requests in parallel', function (done) {

        var requestBody = '{ "requests": [{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/item"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/profile"},' +
            '{"method": "get", "path": "/fetch"}' +
            '] }';

        var asyncSpy = Sinon.spy(Async, 'parallel');
        makeRequest(requestBody, function (res) {

            expect(res[0].id).to.equal('fa0dbda9b1b');
            expect(res[0].name).to.equal('John Doe');
            expect(res.length).to.equal(80);
            expect(res[1].id).to.equal('55cf687663');
            expect(res[1].name).to.equal('Active Item');
            expect(asyncSpy.args[0][0].length).to.equal(80);
            done();
        });
    });

    it('supports piping a response into the next request', function (done) {

        makeRequest('{ "requests": [ {"method": "get", "path": "/item"}, {"method": "get", "path": "/item/$0.id"}] }', function (res) {

            expect(res.length).to.equal(2);
            expect(res[0].id).to.equal('55cf687663');
            expect(res[0].name).to.equal('Active Item');
            expect(res[1].id).to.equal('55cf687663');
            expect(res[1].name).to.equal('Item');
            done();
        });
    });

    it('includes errors when they occur in the request', function (done) {

        makeRequest('{ "requests": [ {"method": "get", "path": "/item"}, {"method": "get", "path": "/nothere"}] }', function (res) {

            expect(res.length).to.equal(2);
            expect(res[0].id).to.equal('55cf687663');
            expect(res[0].name).to.equal('Active Item');
            expect(res[1].error).to.exist;
            done();
        });
    });

    it('bad requests return the correct error', function (done) {

        makeRequest('{ "blah": "test" }', function (res) {

            expect(res.code).to.equal(400);
            done();
        });
    });

    it('handles bad paths in requests array', function (done) {

        makeRequest('{ "requests": [ {"method": "get", "path": "/$1"}] }', function (res) {

            expect(res.code).to.equal(400);
            done();
        });
    });

    it('handles errors in the requested handlers', function (done) {

        makeRequest('{ "requests": [ {"method": "get", "path": "/error"}] }', function (res) {

            expect(res[0].code).to.equal(500);
            expect(res[0].message).to.equal('myerror');
            done();
        });
    });

    it('an out of bounds reference returns an error', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/item"}, {"method": "get", "path": "/item/$1.id"}] }', function (res) {

            expect(res.error).to.equal('Bad Request');
            done();
        });
    });

    it('a non-existant reference returns an internal error', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/item"}, {"method": "get", "path": "/item/$0.nothere"}] }', function (res) {

            expect(res.message).to.equal('Reference not found');
            done();
        });
    });

    it('handles a bad character in the reference value', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/badchar"}, {"method": "get", "path": "/item/$0.name"}] }', function (res) {

            expect(res.code).to.equal(500);
            expect(res.message).to.equal('Reference value includes illegal characters');
            done();
        });
    });

    it('cannot use invalid character to request reference', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/badvalue"}, {"method": "get", "path": "/item/$:.name"}] }', function (res) {

            expect(res.code).to.equal(400);
            done();
        });
    });

    it('handles missing reference', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/badvalue"}, {"method": "get", "path": "/item/$0.name"}] }', function (res) {

            expect(res.code).to.equal(500);
            expect(res.message).to.equal('Missing reference response');
            done();
        });
    });

    it('handles error when getting reference value', function (done) {

        makeRequest('{ "requests": [{"method": "get", "path": "/item"}, {"method": "get", "path": "/item/$0.1"}] }', function (res) {

            expect(res.code).to.equal(500);
            done();
        });
    });
});