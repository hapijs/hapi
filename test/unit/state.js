// Load modules

var Chai = require('chai');
var Iron = require('iron');
var Hapi = require('../helpers');
var State = process.env.TEST_COV ? require('../../lib-cov/state') : require('../../lib/state');
var Defaults = process.env.TEST_COV ? require('../../lib-cov/defaults') : require('../../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('State', function () {

    describe('#parseCookies', function () {

        it('skips cookie header parsing', function (done) {

            var request = {
                raw: {
                    req: {
                        headers: {
                            cookie: 'a=b'
                        }
                    }
                },
                server: {
                    _stateDefinitions: {},
                    settings: {
                        state: {
                            cookies: {
                                parse: false
                            }
                        }
                    }
                }
            };

            State.parseCookies(request, function (err) {

                expect(err).not.to.exist;
                expect(request.state).to.not.exist;
                done();
            });
        });

        describe('cases', function () {

            var pass = function (header, values, settings, definitions) {

                it('parses cookie header: ' + header, function (done) {

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
                        }
                    };

                    State.parseCookies(request, function (err) {

                        expect(err).not.to.exist;
                        expect(request.state).to.deep.equal(values);
                        done();
                    });
                });
            };

            pass('a=b', { a: 'b' });
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
            pass('key=dGVzdA==', { key: 'test' }, null, { key: { encoding: 'base64' } });
            pass('key=dGVzdA', { key: 'test' }, null, { key: { encoding: 'base64' } });
            pass('key=eyJ0ZXN0aW5nIjoianNvbiJ9', { key: { testing: 'json' } }, null, { key: { encoding: 'base64json' } });
            pass('key=Fe26.1**0c68b200eb53406edefb402bb84e265d056bd11eb6bdebf3627a4fd7d1db6d79*XL-d8bUCuSwIwIYtmjXZ3g*4yVxLHFllbJWLSve93se4w*34771b9abd1cadeb0118e2a337c066f32cb44c223e3610533fc56ef3bbc53d56*HEfokc825mlBi-9jm1I94DWeZJ5uifVRD0kx_o-jKp8', { key: { a: 1 } }, null, { key: { encoding: 'iron', password: 'password' } });
            pass('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*xGhc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo', { sid: { a: '1', b: '2', c: '3 x' } }, null, { sid: { encoding: 'form', sign: { password: 'password' } } });

            var fail = function (header, settings, definitions) {

                it('fails parsing cookie header: ' + header, function (done) {

                    var ignore = false;

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
                            ignore = true;
                        }
                    };

                    State.parseCookies(request, function (err) {

                        if (ignore) {
                            expect(err).to.not.exist;
                        }
                        else {
                            expect(err).to.exist;
                        }

                        done();
                    });
                });
            };

            fail('a="1; b="2"; c=3');
            fail('a@="1"; b="2"; c=3');
            fail('a=1; b=2; c=3;;');
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9', null, { key: { encoding: 'base64json' } });
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9; key=XeyJ0ZXN0aW5dnIjoianNvbiJ9', null, { key: { encoding: 'base64json' } });
            fail('key=Fe26.2**0c68b200eb53406edefb402bb84e265d056bd11eb6bdebf3627a4fd7d1db6d79*XL-d8bUCuSwIwIYtmjXZ3g*4yVxLHFllbJWLSve93se4w*34771b9abd1cadeb0118e2a337c066f32cb44c223e3610533fc56ef3bbc53d56*HEfokc825mlBi-9jm1I94DWeZJ5uifVRD0kx_o-jKp8', null, { key: { encoding: 'iron', password: 'password' } });
            fail('key=Fe26.1**0c68b200eb53406edefb402bb84e265d056bd11eb6bdebf3627a4fd7d1db6d79*XL-d8bUCuSwIwIYtmjXZ3g*4yVxLHFllbJWLSve93se4w*34771b9abd1cadeb0118e2a337c066f32cb44c223e3610533fc56ef3bbc53d56*HEfokc825mlBi-9jm1I94DWeZJ5uifVRD0kx_o-jKp8', null, { key: { encoding: 'iron', password: 'passwordx' } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*khsb8lmkNJS-iljqDKZDMmd__2PcHBz7Ksrc-48gZ-0', null, { sid: { encoding: 'form', sign: {} } });
            fail('sid=a=1&b=2&c=3%20x', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x; sid=a=1&b=2&c=3%20x', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8', null, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x.2d75635d74c1a987f84f3ee7f3113b9a2ff71f89d6692b1089f19d5d11d140f8*-Ghc6WvkE55V-TzucCl0NVFmbijeCwgs5Hf5tAVbSUo', null, { sid: { encoding: 'form', sign: { password: 'password' } } });

            var setLog = Hapi.utils.clone(Defaults.server.state);
            setLog.cookies.failAction = 'log';
            fail('abc="xyz', setLog);
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9', setLog, { key: { encoding: 'base64json' } });
            fail('key=XeyJ0ZXN0aW5nIjoianNvbiJ9; key=XeyJ0ZXN0aW5dnIjoianNvbiJ9', setLog, { key: { encoding: 'base64json' } });
            fail('sid=a=1&b=2&c=3%20x', setLog, { sid: { encoding: 'form', sign: { password: 'password' } } });
            fail('sid=a=1&b=2&c=3%20x; sid=a=1&b=2&c=3%20x', setLog, { sid: { encoding: 'form', sign: { password: 'password' } } });
        });
    });

    describe('#generateSetCookieHeader', function () {

        it('skips an empty header', function (done) {

            State.generateSetCookieHeader(null, null, function (err, header) {

                expect(err).to.not.exist;
                expect(header).to.deep.equal([]);
                done();
            });
        });

        it('formats a header', function (done) {

            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } }, null, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3600; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                done();
            });
        });

        it('formats a header with server definition', function (done) {

            var definitions = { sid: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } };
            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf' }, definitions, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3600; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                done();
            });
        });

        it('formats a header with server definition (base64)', function (done) {

            var definitions = { sid: { encoding: 'base64' } };
            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf' }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=ZmloZmlldWhyOTM4NGhm');
                done();
            });
        });

        it('formats a header with server definition (base64json)', function (done) {

            var definitions = { sid: { encoding: 'base64json' } };
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

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

            State.generateSetCookieHeader({ name: 'sid', value: bad }, definitions, function (err, header) {

                expect(err).to.exist;
                done();
            });
        });

        it('formats a header with server definition (form)', function (done) {

            var definitions = { sid: { encoding: 'form' } };
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

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
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

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
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: '3 x' } }, definitions, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Failed to sign cookie (sid) value: Empty password');
                done();
            });
        });

        it('formats a header with server definition (iron)', function (done) {

            var definitions = { sid: { encoding: 'iron', password: 'password' } };
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.not.exist;
                expect(header[0]).to.have.string('sid=Fe26.1*');
                done();
            });
        });

        it('fails a header with bad server definition (iron)', function (done) {

            var definitions = { sid: { encoding: 'iron' } };
            State.generateSetCookieHeader({ name: 'sid', value: { a: 1, b: 2, c: 3 } }, definitions, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Failed to encode cookie (sid) value: Empty password');
                done();
            });
        });

        it('formats a header with multiple cookies', function (done) {

            State.generateSetCookieHeader([
                { name: 'sid', value: 'fihfieuhr9384hf', options: { ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' } },
                { name: 'pid', value: 'xyz' }
            ], null, function (err, header) {

                var expires = new Date(Date.now() + 3600);
                expect(err).to.not.exist;
                expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3600; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
                expect(header[1]).to.equal('pid=xyz');
                done();
            });
        });

        it('fails on bad cookie name', function (done) {

            State.generateSetCookieHeader({ name: 's;id', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie name: s;id');
                done();
            });
        });

        it('fails on bad cookie value', function (done) {

            State.generateSetCookieHeader({ name: 'sid', value: 'fi"hfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie value: fi"hfieuhr9384hf');
                done();
            });
        });

        it('fails on bad cookie domain', function (done) {

            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: '-example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie domain: -example.com');
                done();
            });
        });

        it('fails on too long cookie domain', function (done) {

            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: '/', domain: '1234567890123456789012345678901234567890123456789012345678901234567890.example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Cookie domain too long: 1234567890123456789012345678901234567890123456789012345678901234567890.example.com');
                done();
            });
        });

        it('fails on bad cookie path', function (done) {

            State.generateSetCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', options: { isSecure: true, isHttpOnly: false, path: 'd', domain: 'example.com' } }, null, function (err, header) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid cookie path: d');
                done();
            });
        });
    });
});




