// Load modules

var Chai = require('chai');
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
                expect(request.cookies).to.not.exist;
                done();
            });
        });

        describe('cases', function () {

            var pass = function (header, values, settings) {

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
                            settings: {
                                state: settings || Defaults.server.state
                            }
                        }
                    };

                    State.parseCookies(request, function (err) {

                        expect(err).not.to.exist;
                        expect(request.cookies).to.deep.equal(values);
                        done();
                    });
                });
            };

            pass('a=b', { a: 'b' });
            pass('a=123', { a: 123 });
            pass('a=1; a=2', { a: [1, 2] });
            pass('a=1; b="2"; c=3', { a: 1, b: 2, c: 3 });
            pass('a="1"; b="2"; c=3;', { a: 1, b: 2, c: 3 });
            pass('A    = b;   b  =   c', { A: 'b', b: 'c' });
            pass('a="b=123456789&c=something"', { a: 'b=123456789&c=something' });
            pass('a=%1;b=x', { a: '%1', b: 'x' });
            pass('z=%20%22%2c%3b%2f', { z: ' ",;/' });

            var noValueParsing = Hapi.utils.clone(Defaults.server.state);
            noValueParsing.cookies.parseValues = false;
            pass('z=%20%22%2c%3b%2f', { z: '%20%22%2c%3b%2f' }, noValueParsing);
            pass('a=123', { a: '123' }, noValueParsing);

            var fail = function (header, settings) {

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

            var setLog = Hapi.utils.clone(Defaults.server.state);
            setLog.cookies.failAction = 'log';
            fail('abc="xyz', setLog);
        });
    });

    describe('#setCookieHeader', function () {

        it('skips an empty header', function (done) {

            var header = State.setCookieHeader();
            expect(header).to.deep.equal([]);
            done();
        });

        it('formats a header correctly', function (done) {

            var header = State.setCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' });
            var expires = new Date(Date.now() + 3600);
            expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3600; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
            done();
        });

        it('formats a header correctly with multiple cookies', function (done) {

            var header = State.setCookieHeader([
                { name: 'sid', value: 'fihfieuhr9384hf', ttl: 3600, isSecure: true, isHttpOnly: true, path: '/', domain: 'example.com' },
                { name: 'pid', value: 'xyz' }
            ]);
            var expires = new Date(Date.now() + 3600);
            expect(header[0]).to.equal('sid=fihfieuhr9384hf; Max-Age=3600; Expires=' + expires.toUTCString() + '; Secure; HttpOnly; Domain=example.com; Path=/');
            expect(header[1]).to.equal('pid=xyz');
            done();
        });

        it('fails on bad cookie name', function (done) {

            var header = State.setCookieHeader({ name: 's;id', value: 'fihfieuhr9384hf', isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' });
            expect(header instanceof Error).to.equal(true);
            expect(header.message).to.equal('Invalid cookie name: s;id');
            done();
        });

        it('fails on bad cookie value', function (done) {

            var header = State.setCookieHeader({ name: 'sid', value: 'fi"hfieuhr9384hf', isSecure: true, isHttpOnly: false, path: '/', domain: 'example.com' });
            expect(header instanceof Error).to.equal(true);
            expect(header.message).to.equal('Invalid cookie value: fi"hfieuhr9384hf');
            done();
        });

        it('fails on bad cookie domain', function (done) {

            var header = State.setCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', isSecure: true, isHttpOnly: false, path: '/', domain: '-example.com' });
            expect(header instanceof Error).to.equal(true);
            expect(header.message).to.equal('Invalid cookie domain: -example.com');
            done();
        });

        it('fails on too long cookie domain', function (done) {

            var header = State.setCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', isSecure: true, isHttpOnly: false, path: '/', domain: '1234567890123456789012345678901234567890123456789012345678901234567890.example.com' });
            expect(header instanceof Error).to.equal(true);
            expect(header.message).to.equal('Cookie domain too long: 1234567890123456789012345678901234567890123456789012345678901234567890.example.com');
            done();
        });

        it('fails on bad cookie path', function (done) {

            var header = State.setCookieHeader({ name: 'sid', value: 'fihfieuhr9384hf', isSecure: true, isHttpOnly: false, path: 'd', domain: 'example.com' });
            expect(header instanceof Error).to.equal(true);
            expect(header.message).to.equal('Invalid cookie path: d');
            done();
        });
    });
});




