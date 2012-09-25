// Load modules

var expect = require('chai').expect;
var Hapi = require('../../lib/hapi');
var S = Hapi.Types.String;

describe('Documentation', function() {
    var _routeTemplate = '{{#each routes}}{{this.method}}|{{/each}}';
    var _indexTemplate = '{{#each routes}}{{this.path}}|{{/each}}';
    var _server = null;
    var _serverUrl = 'http://127.0.0.1:8083';

    var handler = function(request) {
        request.reply('ok');
    };

    function setupServer(done) {
        _server = new Hapi.Server('0.0.0.0', 8083, { authentication: false, docs: { routeTemplate: _routeTemplate, indexTemplate: _indexTemplate }});
        _server.addRoutes([
            { method: 'GET', path: '/test', config: { handler: handler, query: { param1: S().required() } } },
            { method: 'POST', path: '/test', config: { handler: handler, query: { param2: S().valid('first', 'last') } } }
        ]);
        _server.listener.on('listening', function() {
            done();
        });
        _server.start();
    }

    function teardownServer(done) {
        _server.stop();
        done();
    }

    function makeRequest(path, callback) {
        var next = function(res) {
            return callback(res.result);
        };

        _server.inject({
            method: 'get',
            url: _serverUrl + path
        }, next);
    }

    before(setupServer);
    after(teardownServer);

    it('shows template when correct path is provided', function(done) {
        makeRequest('/docs?path=/test', function(res) {
            expect(res).to.equal('GET|POST|');
            done();
        });
    });

    it('has a Not Found response when wrong path is provided', function(done) {
        makeRequest('/docs?path=blah', function(res) {
            expect(res.error).to.equal('Not Found');
            done();
        });
    });

    it('displays the index if no path is provided', function(done) {
        makeRequest('/docs', function(res) {
            expect(res).to.equal('/test|/test|');
            done();
        });
    });

    it('the index does\'t have the docs endpoint listed', function(done) {
        makeRequest('/docs', function(res) {
            expect(res).to.not.contain('/docs');
            done();
        });
    });
});