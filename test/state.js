// Load modules

var Lab = require('lab');
var Iron = require('iron');
var Hoek = require('hoek');
var Hapi = require('..');
var State = require('../lib/state');
var Defaults = require('../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('State', function () {

    it('skips parsing cookies', function (done) {

        var server = new Hapi.Server({ state: { cookies: { parse: false } } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.state) } });
        server.inject({ method: 'GET', url: '/', headers: { cookie: 'v=a' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            done();
        });
    });

    it('does not clear invalid cookie if cannot parse', function (done) {

        var server = new Hapi.Server({ state: { cookies: { clearInvalid: true } } });
        server.inject({ method: 'GET', url: '/', headers: { cookie: 'v=a,b' } }, function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.headers['set-cookie']).to.not.exists;
            done();
        });
    });

    it('sets cookie value automatically', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
        server.state('always', { autoValue: 'present' });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.deep.equal(['always=present']);
            done();
        });
    });

    it('does not clobber already set cookies', function (done) {

        var handler = function (request, reply) {
            reply().header('set-cookie', ['onecookie=yes', 'twocookie=no']);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });
        server.state('always', { autoValue: 'present' });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.deep.equal(['onecookie=yes', 'twocookie=no', 'always=present']);
            done();
        });
    });

    it('sets cookie value automatically using function', function (done) {

        var present = function (request, next) {

            next(null, request.params.x)
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/{x}', handler: function (request, reply) { reply('ok'); } });
        server.state('always', { autoValue: present });

        server.inject('/sweet', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.deep.equal(['always=sweet']);
            done();
        });
    });

    it('fails to set cookie value automatically using function', function (done) {

        var present = function (request, next) {

            next(new Error())
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
        server.state('always', { autoValue: present });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(500);
            expect(res.headers['set-cookie']).to.not.exist;
            done();
        });
    });

    describe('#parseCookies', function () {

        describe('cases', function () {

            var pass = function (header, values, settings, definitions) {

                it('parses cookie header: ' + header, function (done) {

                    var server = new Hapi.Server({ state: settings || Defaults.server.state });

                    if (definitions) {
                        var cookies = Object.keys(definitions);
                        for (var i = 0, il = cookies.length; i < il; ++i) {
                            var cookie = cookies[i];
                            server.state(cookie, definitions[cookie]);
                        }
                    }

                    server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.state); } });

                    server.inject({ method: 'GET', url: '/', headers: { cookie: header } }, function (res) {

                        expect(res.statusCode).to.equal(200);
                        if (values) {
                            expect(res.result).to.deep.equal(values);
                        }
                        done();
                    });
                });
            };

            pass('a=b', { a: 'b' });
            pass('a=', { a: '' });
            pass('a=""', { a: '' });
            pass('a=;', { a: '' });
            pass('a=123', { a: '123' });
            pass('a=1; a=2', { a: ['1', '2'] });
            pass('a=1; b="2"; c=3', { a: '1', b: '2', c: '3' });
            pass('a="1"; b="2"; c=3;', { a: '1', b: '2', c: '3' });
            pass('A    = b;   b  =   c', { A: 'b', b: 'c' });
            pass('a="b=123456789&c=something"', { a: 'b=123456789&c=something' });
            pass('a=%1;b=x', { a: '%1', b: 'x' });
            pass('z=%20%22%2c%3b%2f', { z: '%20%22%2c%3b%2f' });

            pass('a="b=123456789&c=something%20else"', { a: { b: '123456789', c: 'something else' } }, null, { a: { encoding: 'form' } });
            pass('a="b=%p123456789"', { a: { b: '%p123456789' } }, null, { a: { encoding: 'form' } });
            pass('a=dGVzdA; a=dGVzdA', { a: ['test', 'test'] }, null, { a: { encoding: 'base64' } });
            pass('a=dGVzdA; a=dGVzdA; a=dGVzdA', { a: ['test', 'test', 'test'] }, null, { a: { encoding: 'base64' } });
            pass('key=dGVzdA==', { key: 'test' }, null, { key: { encoding: 'base64' } });
            pass('key=dGVzdA', { key: 'test' }, null, { key: { encoding: 'base64' } });
            pass('key=dGVzdA', { key: 'dGVzdA' }, null, { key: { encoding: 'none' } });
            pass('key=eyJ0ZXN0aW5nIjoianNvbiJ9', { key: { testing: 'json' } }, null, { key: { encoding: 'base64json' } });
            pass('key=Fe26.2**f3fc42242467f7a97c042be866a32c1e7645045c2cc085124eadc66d25fc8395*URXpH8k-R0d4O5bnY23fRQ*uq9rd8ZzdjZqUrq9P2Ci0yZ-EEUikGzxTLn6QTcJ0bc**3880c0ac8bab054f529afec8660ebbbbc8050e192e39e5d622e7ac312b9860d0*r_g7N9kJYqXDrFlvOnuKpfpEWwrJLOKMXEI43LAGeFg', { key: { a: 1, b: 2, c: 3 } }, null, { key: { encoding: 'iron', password: 'password' } });
            pass('key=Fe26.2**f3fc42242467f7a97c042be866a32c1e7645045c2cc085124eadc66d25fc8395*URXpH8k-R0d4O5bnY23fRQ*uq9rd8ZzdjZqUrq9P2Ci0yZ-EEUikGzxTLn6QTcJ0bc**3880c0ac8bab054f529afec8660ebbbbc8050e192e39e5d622e7ac312b9860d0*r_g7N9kJYqXDrFlvOnuKpfpEWwrJLOKMXEI43LAGeFg', { key: { a: 1, b: 2, c: 3 } }, null, { key: { encoding: 'iron', password: 'password', iron: Iron.defaults } });
            pass('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*xGhc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo', { sid: { a: '1', b: '2', c: '3 x' } }, null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            pass('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*xGhc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo', { sid: { a: '1', b: '2', c: '3 x' } }, null, { sid: { encoding: 'form', sign: { password: 'password', integrity: Iron.defaults.integrity } } });

            var loose = Hoek.clone(Defaults.server.state);
            loose.cookies.strictHeader = false;
            pass('a="1; b="2"; c=3; d[1]=4', { a: '"1', b: '2', c: '3', 'd[1]': '4' }, loose);

            var fail = function (header, settings, definitions, result) {

                it('fails parsing cookie header: ' + header, function (done) {

                    var logged = false;
                    var cleared = '';

                    var request = {
                        raw: {
                            req: {
                                headers: {
                                    cookie: header
                                }
                            }
                        },
                        server: {
                            _stateDefinitions: definitions || {},
                            settings: {
                                state: settings || Defaults.server.state
                            }
                        },
                        log: function (tags, data) {

                            logged = true;
                        },
                        _clearState: function (name) {

                            cleared = name;
                        }
                    };

                    State.parseCookies(request, function (err) {

                        if (request.server.settings.state.cookies.failAction !== 'error') {
                            expect(err).to.not.exist;
                            expect(settings.failAction !== 'ignore' || logged).to.equal(true);
                        }
                        else {
                            expect(err).to.exist;
                            expect(logged).to.equal(true);
                        }

                        if (request.server.settings.state.cookies.clearInvalid) {
                            expect(cleared).to.equal('sid');
                        }

                        expect(request.state).to.deep.equal(result || {});
                        done();
                    });
                });
            };

            fail('a="1; b="2"; c=3');
            fail('a@="1"; b="2"; c=3');
            fail('a=1; b=2; c=3;;');
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9', null, { key: { encoding: 'base64json' } });
            fail('x=XeyJ0ZXN0aW5nIjoianNvbiJ9; x=XeyJ0ZXN0aW5dnIjoianNvbiJ9', null, { x: { encoding: 'base64json' } });
            fail('key=Fe26.1**f3fc42242467f7a97c042be866a32c1e7645045c2cc085124eadc66d25fc8395*URXpH8k-R0d4O5bnY23fRQ*uq9rd8ZzdjZqUrq9P2Ci0yZ-EEUikGzxTLn6QTcJ0bc**3880c0ac8bab054f529afec8660ebbbbc8050e192e39e5d622e7ac312b9860d0*r_g7N9kJYqXDrFlvOnuKpfpEWwrJLOKMXEI43LAGeFg', null, { key: { encoding: 'iron', password: 'password' } });
            fail('key=Fe26.2**f3fc42242467f7a97c042be866a32c1e7645045c2cc085124eadc66d25fc8395*URXpH8k-R0d4O5bnY23fRQ*uq9rd8ZzdjZqUrq9P2Ci0yZ-EEUikGzxTLn6QTcJ0bc**3880c0ac8bab054f529afec8660ebbbbc8050e192e39e5d622e7ac312b9860d0*r_g7N9kJYqXDrFlvOnuKpfpEWwrJLOKMXEI43LAGeFg', null, { key: { encoding: 'iron', password: 'passwordx' } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*khsb8lmkNJS-iljqDKZDMmd__2PcHBz7Ksrc-48gZ-0', null, { sid: { encoding: 'form', sign: {} } });
            fail('sid=a=1&b=2&c=3%20x', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x; sid=a=1&b=2&c=3%20x', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*-Ghc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo', null, { sid: { encoding: 'form', sign: { password: 'password' } } });

            var setLog = Hoek.clone(Defaults.server.state);
            setLog.cookies.failAction = 'log';
            fail('abc="xyzf', setLog, null, { abc: '"xyzf'});
            fail('"abc=xyzf', setLog, null, { '"abc': 'xyzf' });
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9', setLog, { key: { encoding: 'base64json' } });
            fail('y=XeyJ0ZXN0aW5nIjoianNvbiJ9; y=XeyJ0ZXN0aW5dnIjoianNvbiJ9', setLog, { y: { encoding: 'base64json' } });
            fail('sid=a=1&b=2&c=3%20x', setLog, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x; sid=a=1&b=2&c=3%20x', setLog, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('a=1; b=2; key=XeyJ0ZXN0aW5nIjoianNvbiJ9', setLog, { key: { encoding: 'base64json' } }, { a: '1', b: '2' });

            var clearInvalid = Hoek.clone(Defaults.server.state);
            clearInvalid.cookies.clearInvalid = true;
            fail('sid=a=1&b=2&c=3%20x', clearInvalid, { sid: { encoding: 'form', sign: { password: 'password' } } });
        });
    });

    describe('#generateSetCookieHeader', function () {

        var generateSetCookieHeader = function (cookies, definition, callback) {

            var server = { _stateDefinitions: definition, settings: Defaults.server };
            State.generateSetCookieHeader(cookies, server, callback);
        };

        it('skips an empty header', function (done) {

            generateSetCookieHeader(null, null, function (err, header) {

                expect(err).to.not.exist;
                expect(header).to.deep.equal([]);
                done();
            });
        });

        it('skips an empty array', function (done) {

            generateSetCookieHeader([], null, function (err, header) {

                expect(err).to.not.exist;
                expect(header).to.deep.equal([]);
                done();
            });
        });

        it('formats a header', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } }, null, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                done();
            });
        });

        it('formats a header with null value', function (done) {

            generateSetCookieHeader({ name: 'sid', options: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } }, null, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=; Max-Age=3; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                done();
            });
        });

        it('formats a header with server definition', function (done) {

            var definitions = { sid: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } };
            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf' }, definitions, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                done();
            });
        });

        it('formats a header with server definition (base64)', function (done) {

            var definitions = { sid: { encoding: 'base64' } };
            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf' }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=ZmloZmlldWhyOTM4NGhm');
                done();
            });
        });

        it('formats a header with server definition (base64json)', function (done) {

            var definitions = { sid: { encoding: 'base64json' } };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=eyJhIjoxLCJiIjoyLCJjIjozfQ==');
                done();
            });
        });

        it('fails on a header with server definition and bad value (base64json)', function (done) {

            var definitions = { sid: { encoding: 'base64json' } };
            var bad = { a: {} };
            bad.b = bad.a;
            bad.a.x = bad.b;

            generateSetCookieHeader({ name: 'sid', value: bad }, definitions, function (err, header) {

                expect(err).to.exist;
                done();
            });
        });

        it('formats a header with server definition (form)', function (done) {

            var definitions = { sid: { encoding: 'form' } };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=a=1&b=2&c=3%20x');
                done();
            });
        });

        it('formats a header with server definition (form+sign)', function (done) {

            var definitions = {
                sid: {
                    encoding: 'form',
                    sign: {
                        password: 'password',
                        integrity: {
                            saltBits: 256,
                            algorithm: 'sha256',
                            iterations: 1,
                            salt: '2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8'
                        }
                    }
                }
            };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*xGhc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo');
                done();
            });
        });

        it('fails a header with bad server definition (form+sign)', function (done) {

            var definitions = {
                sid: {
                    encoding: 'form',
                    sign: {}
                }
            };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Failed to sign cookie (sid) value: Empty password');
                done();
            });
        });

        it('formats a header with server definition (iron)', function (done) {

            var definitions = { sid: { encoding: 'iron', password: 'password' } };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.have.string('sid=Fe26.2*');
                done();
            });
        });

        it('formats a header with server definition (iron + options)', function (done) {

            var definitions = { sid: { encoding: 'iron', password: 'password', iron: Iron.defaults } };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.have.string('sid=Fe26.2*');
                done();
            });
        });

        it('fails a header with bad server definition (iron)', function (done) {

            var definitions = { sid: { encoding: 'iron' } };
            generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Failed to encode cookie (sid) value: Empty password');
                done();
            });
        });

        it('formats a header with multiple cookies', function (done) {

            generateSetCookieHeader([
                { name: 'sid', value: 'fihfieuhr9384hf', options: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } },
                { name: 'pid', value: 'xyz' }
            ], null, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                expect(header[1]).to.equal('pid=xyz');
                done();
            });
        });

        it('fails on bad cookie name', function (done) {

            generateSetCookieHeader({ name: 's;id', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie name: s;id');
                done();
            });
        });

        it('allows bad cookie name in loose mode', function (done) {

            var server = { _stateDefinitions: null, settings: Hoek.clone(Defaults.server) };
            server.settings.state.cookies.strictHeader = false;
            State.generateSetCookieHeader({ name: 's;id', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, server, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('s;id=fihfieuhr9384hf; Secure; Domain=example.com; Path=/');
                done();
            });
        });

        it('fails on bad cookie value', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fi"hfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie value: fi"hfieuhr9384hf');
                done();
            });
        });

        it('allows bad cookie value in loose mode', function (done) {

            var server = { _stateDefinitions: null, settings: Hoek.clone(Defaults.server) };
            server.settings.state.cookies.strictHeader = false;
            State.generateSetCookieHeader({ name: 'sid', value: 'fi"hfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, server, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fi"hfieuhr9384hf; Secure; Domain=example.com; Path=/');
                done();
            });
        });

        it('fails on bad cookie domain', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: '-example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie domain: -example.com');
                done();
            });
        });

        it('fails on too long cookie domain', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: '1234567890123456789012345678901234567890123456789012345678901234567890.example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Cookie domain too long: 1234567890123456789012345678901234567890123456789012345678901234567890.example.com');
                done();
            });
        });

        it('formats a header with cookie domain with . prefix', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: '.12345678901234567890.example.com' } }, null, function (err, header) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('fails on bad cookie path', function (done) {

            generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: 'd', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie path: d');
                done();
            });
        });
    });

    describe('#prepareValue', function () {

        it('throws when missing options', function (done) {

            expect(function () {

                Hapi.state.prepareValue('name', 'value');
            }).to.throw('Missing or invalid options');
            done();
        });
    });
});
