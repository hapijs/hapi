// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Route = require(libPath + 'route');
var Hapi = require(libPath + 'hapi');


describe('Route', function() {

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18095';
    var _routes = [];
    var _paths = {
        '/': { reqPath: '/', resBody: 'test1' },
        '/path': { reqPath: '/path', resBody: 'test2' },
        '/path/': { reqPath: '/path/', resBody: 'test3' },
        '/path/to/somewhere': { reqPath: '/path/to/somewhere', resBody: 'test4' },
        '/test1/param/{param}': { reqPath: '/test1/param/test5', resBody: 'test5' },
        '/test2/param/{param?}': { reqPath: '/test2/param/test6', resBody: 'test6' },
        '/test3/param/{param?}': { reqPath: '/test3/param', resBody: 'test7' },
        '/test4/param/{param*2}': { reqPath: '/test4/param/test8/test9', resBody: '/test8/test9' },
        '/test5/%20path': { reqPath: '/test5/%20path', resBody: 'test10' }
    };

    var _handler = function(options) {

        return function (request) {

            var resBody = options.resBody;
            if (request.params.param) {
                resBody = request.params.param;
            }

            request.reply(resBody);
        };
    };

    function setupServer(done) {

        _server = new Hapi.Server('0.0.0.0', 18095, { cache: { engine: 'memory' } });
        _server.addRoutes(_routes);
        _server.listener.on('listening', function() {

            done();
        });

        _server.start();
    }

    before(setupServer);

    function makeRequest(path, callback) {

        var next = function(res) {

            return callback(res);
        };

        _server.inject({
            method: 'get',
            url: _serverUrl + path
        }, next);
    }

    (function() {

        var test = function (path, options) {

            _routes.push({ method: 'GET', path: path, handler: _handler(options) });

            it('routes the path \'' + path + '\' to the correct route with the expected params set', function (done) {

                makeRequest(options.reqPath, function(res) {

                    expect(res.result).to.equal(options.resBody);
                    done();
                });

            });
        };

        var keys = Object.keys(_paths);
        for (var i = 0, il = keys.length; i < il; ++i) {
            test(keys[i], _paths[keys[i]]);
        }
    })();
});