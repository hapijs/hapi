// Load modules

var expect = require('chai').expect;
var Hapi = require('../../lib/hapi');
var S = Hapi.Types.String;


var _template = '{{#each routes}}{{this.method}}|{{/each}}';
var _http = new Hapi.Server('0.0.0.0', 8083, { name: 'test', docs: { template: _template }});
var _serverUrl = 'http://127.0.0.1:8083';

function setupServer(done) {
    var handler = function(request) {
        request.reply('ok');
    };

    _http.addRoutes([
        { method: 'GET', path: '/test', config: { handler: handler, query: { param1: S() } } },
        { method: 'POST', path: '/test', config: { handler: handler, query: { param2: S() } } }
    ]);

    _http.start();
    done();
}

function makeRequest(path, callback) {
    var next = function(res) {
      return callback(res.result);
    };

    _http.inject({
        method: 'get',
        url: _serverUrl + path
    }, next);
}

describe('Documentation generator', function() {
    before(setupServer);

    it('shows template when correct path is provided', function(done) {
        makeRequest('/docs?path=/test', function(res) {
            expect(res).to.equal('GET|POST|');
            done();
        });
    });

    it('has a null response when wrong path is provided', function(done) {
        makeRequest('/docs?path=blah', function(res) {
            expect(res).to.be.null;
            done();
        });
    });

    it('has an error response if no path is provided', function(done) {
        makeRequest('/docs', function(res) {
            expect(res.error).to.exist;
            done();
        });
    });
});