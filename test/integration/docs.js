// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;
var S = Hapi.types.String;


describe('Docs Generator', function () {

    var _routeTemplate = '{{#each routes}}{{this.method}}|{{/each}}';
    var _indexTemplate = '{{#each routes}}{{this.path}}|{{/each}}';
    var _server = null;
    var _serverWithoutPost = null;

    var handler = function (request) {

        request.reply('ok');
    };

    function setupServer(done) {

        _server = new Hapi.Server('0.0.0.0', 0);
        _server.addRoutes([
            { method: 'GET', path: '/docs', handler: { docs: { routeTemplate: _routeTemplate, indexTemplate: _indexTemplate } } },
            { method: 'GET', path: '/defaults', handler: { docs: true } },
            { method: 'GET', path: '/test', config: { handler: handler, query: { param1: S().required() } } },
            { method: 'POST', path: '/test', config: { handler: handler, query: { param2: S().valid('first', 'last') } } }
        ]);

        _server.start(done);
    }

    function setupServerWithoutPost(done) {

        _serverWithoutPost = new Hapi.Server('0.0.0.0', 0);
        _serverWithoutPost.addRoutes([
            { method: 'GET', path: '/docs', handler: { docs: { routeTemplate: _routeTemplate, indexTemplate: _indexTemplate } } },
            { method: 'GET', path: '/test', config: { handler: handler, query: { param1: S().required() } } }
        ]);

        _serverWithoutPost.start(done);
    }

    function makeRequest(path, callback) {

        var next = function (res) {

            return callback(res.result);
        };

        _server.inject({
            method: 'get',
            url: path
        }, next);
    }

    before(setupServer);

    it('shows template when correct path is provided', function (done) {

        makeRequest('/docs?path=/test', function (res) {

            expect(res).to.equal('GET|POST|');
            done();
        });
    });

    it('has a Not Found response when wrong path is provided', function (done) {

        makeRequest('/docs?path=blah', function (res) {

            expect(res.error).to.equal('Not Found');
            done();
        });
    });

    it('displays the index if no path is provided', function (done) {

        makeRequest('/docs', function (res) {

            expect(res).to.equal('/defaults|/defaults|/test|/test|/test|/test|');
            done();
        });
    });

    it('the index does\'t have the docs endpoint listed', function (done) {

        makeRequest('/docs', function (res) {

            expect(res).to.not.contain('/docs');
            done();
        });
    });

    it('shows template when correct path is provided using defaults', function (done) {

        makeRequest('/defaults?path=/test', function (res) {

            expect(res).to.contain('<!DOCTYPE html>');
            done();
        });
    });

    describe('Index', function () {

        before(setupServerWithoutPost);

        it('doesn\'t throw an error when requesting the index when there are no POST routes', function (done) {

            _serverWithoutPost.inject({
                method: 'get',
                url: '/docs'
            }, function (res) {

                expect(res).to.exist;
                expect(res.result).to.contain('/test');
                done();
            });
        });
    });
});