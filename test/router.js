// Load modules

var Lab = require('lab');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Router', function () {

    it('matches HEAD routes', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/head', handler: function (request, reply) { reply('ok-common'); } });
        server.route({ method: 'GET', path: '/head', vhost: 'special.example.com', handler: function (request, reply) { reply('ok-vhost'); } });
        server.route({ method: 'GET', path: '/get', vhost: 'special.example.com', handler: function (request, reply) { reply('just-get'); } });
        server.route({ method: 'HEAD', path: '/head', handler: function (request, reply) { reply('ok').header('x1', '123'); } });
        server.route({ method: 'HEAD', path: '/head', vhost: 'special.example.com', handler: function (request, reply) { reply('ok').header('x1', '456'); } });

        server.inject({ method: 'HEAD', url: 'http://special.example.com/head' }, function (res) {

            expect(res.headers.x1).to.equal('456');

            server.inject('http://special.example.com/head', function (res) {

                expect(res.result).to.equal('ok-vhost');
                expect(res.headers.x1).to.not.exist;

                server.inject({ method: 'HEAD', url: '/head' }, function (res) {

                    expect(res.headers.x1).to.equal('123');

                    server.inject('/head', function (res) {

                        expect(res.result).to.equal('ok-common');
                        expect(res.headers.x1).to.not.exist;

                        server.inject({ method: 'HEAD', url: 'http://special.example.com/get' }, function (res) {

                            expect(res.payload).to.equal('');
                            expect(res.result).to.equal('just-get');
                            done();
                        });
                    });
                });
            });
        });
    });

    it('fails to match head request', function (done) {

        var server = new Hapi.Server();

        server.inject({ method: 'HEAD', url: '/' }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('matches vhost route', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('plain'); } });

        server.inject({ method: 'GET', url: '/', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.result).to.equal('special');
            done();
        });
    });

    it('matches global route when vhost is present but not matching', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/a', handler: function (request, reply) { reply('plain'); } });

        server.inject({ method: 'HEAD', url: '/a', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.payload).to.equal('');
            expect(res.result).to.equal('plain');
            done();
        });
    });

    it('fails to match route when vhost is present but not matching', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/a', handler: function (request, reply) { reply('plain'); } });

        server.inject({ method: 'GET', url: '/b', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('matches vhost route for route with array of vhosts', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('plain'); } });

        server.inject({ method: 'GET', url: '/', headers: { host: 'special2.example.com:8080' } }, function (res) {

            expect(res.result).to.equal('special array');
            done();
        });
    });

    it('matches default host route', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('plain'); } });

        server.inject({ method: 'GET', url: '/', headers: { host: 'example.com' } }, function (res) {

            expect(res.result).to.equal('plain');
            done();
        });
    });

    it('matches vhost to common route', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/common', handler: function (request, reply) { reply('common'); } });

        server.inject({ method: 'GET', url: '/common', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.result).to.equal('common');
            done();
        });
    });

    it('does not allow duplicate routes with the same vhost', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('plain'); } });

        var fn = function () {

            server.route({ method: 'GET', path: '/', vhost: 'special1.example.com', handler: function (request, reply) { reply('special'); } });
        };

        expect(fn).to.throw('New route: / conflicts with existing: /');
        done();
    });

    it('does not allow conflicting routes different in trailing path (optional param in new)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/conflict1', handler: function () { } });

        var fn = function () {

            server.route({ method: 'GET', path: '/conflict1/{p?}', handler: function () { } });
        };

        expect(fn).to.throw('New route: /conflict1/{p?} conflicts with existing: /conflict1');
        done();
    });

    it('does not allow conflicting routes different in trailing path (optional param in existing)', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/conflict2/{p?}', handler: function () { } });

        var fn = function () {

            server.route({ method: 'GET', path: '/conflict2', handler: function () { } });
        };

        expect(fn).to.throw('New route: /conflict2 conflicts with existing: /conflict2/{p?}');
        done();
    });

    it('does allow duplicate routes with a different vhost', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function (request, reply) { reply('special'); } });
        server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function (request, reply) { reply('special array'); } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('plain'); } });

        var fn = function () {

            server.route({ method: 'GET', path: '/', vhost: 'new.example.com', handler: function (request, reply) { reply('special'); } });
        };

        expect(fn).to.not.throw();
        done();
    });

    it('matches wildcard method', function (done) {

        var server = new Hapi.Server();

        server.route({ method: '*', path: '/', handler: function (request, reply) { reply('ok'); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('ok');
            done();
        });
    });

    it('matches wildcard vhost method', function (done) {

        var server = new Hapi.Server();

        server.route({ method: '*', path: '/', handler: function (request, reply) { reply('global'); } });
        server.route({ method: '*', vhost: 'special.example.com', path: '/', handler: function (request, reply) { reply('vhost'); } });
        server.inject('http://special.example.com/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('vhost');
            done();
        });
    });

    it('allows methods array', function (done) {

        var server = new Hapi.Server();

        server.route({ method: ['HEAD', 'GET', 'PUT', 'POST', 'DELETE'], path: '/', handler: function (request, reply) { reply(request.route.method); } });
        server.inject({ method: 'HEAD', url: '/' }, function (res) {

            expect(res.statusCode).to.equal(200);

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('get');

                server.inject({ method: 'PUT', url: '/' }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.payload).to.equal('put');

                    server.inject({ method: 'POST', url: '/' }, function (res) {

                        expect(res.statusCode).to.equal(200);
                        expect(res.payload).to.equal('post');

                        server.inject({ method: 'DELETE', url: '/' }, function (res) {

                            expect(res.statusCode).to.equal(200);
                            expect(res.payload).to.equal('delete');
                            done();
                        });
                    });
                });
            });
        });
    });

    it('does not allow invalid paths', function (done) {

        var server = new Hapi.Server();

        var fn = function () {

            server.route({ method: 'GET', path: '/%/%', handler: function () { } });
        };

        expect(fn).to.throw('Invalid path: /%/%');
        done();
    });

    it('returns 400 on invalid path', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/{p*}', handler: function (request, reply) { reply('ok'); } });
        server.inject('/%/%', function (res) {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('fails matching a required missing param', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/a/{b}', handler: function (request, reply) { reply(request.params.b); } });

        server.inject('/a/', function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    })

    it('fails to return OPTIONS when cors disabled', function (done) {

        var handler = function (request, reply) {

            reply(Hapi.error.badRequest());
        };

        var server = new Hapi.Server({ cors: false });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/' }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });
});
