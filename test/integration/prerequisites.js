// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Prerequesites', function () {

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

    var fetch6 = function (request, next) {

        next(Hapi.error.internal('boom'));
    };

    var getFetch1 = function (request) {

        request.reply(request.pre.m5);
    };

    var getFetch2 = function (request) {

        request.reply(request.pre.m1);
    };

    var server = new Hapi.Server('0.0.0.0', 0, { batch: true });

    server.helper('user', function (id, next) {

        return next({ id: id });
    });

    server.route([
        {
            method: 'GET',
            path: '/fetch1',
            config: {
                pre: [
                    { method: fetch1, assign: 'm1', mode: 'parallel' },
                    { method: fetch2, assign: 'm2' },
                    { method: fetch3, assign: 'm3', mode: 'parallel' },
                    { method: fetch4, assign: 'm4', mode: 'parallel' },
                    { method: fetch5, assign: 'm5' }
                ],
                handler: getFetch1
            }
        },
        {
            method: 'GET',
            path: '/fetch2',
            config: {
                pre: [
                    { method: fetch1, assign: 'm1', mode: 'parallel' }
                ],
                handler: getFetch2
            }
        },
        {
            method: 'GET',
            path: '/fetch3',
            config: {
                pre: [
                    { method: fetch1, assign: 'm1', mode: 'parallel' },
                    { method: fetch6, assign: 'm6' }
                ],
                handler: getFetch2
            }
        },
        {
            method: 'GET',
            path: '/user/{id}',
            config: {
                pre: [
                    'user(params.id)'
                ],
                handler: function () {

                    return this.reply(this.pre.user);
                }
            }
        }
    ]);

    function makeRequest(path, callback) {

        var next = function (res) {

            return callback(res.result);
        };

        server.inject({
            method: 'get',
            url: path
        }, next);
    }

    it('shows the complete prerequisite pipeline in the response', function (done) {

        makeRequest('/fetch1', function (res) {

            expect(res).to.equal('Hello World!');
            done();
        });
    });

    it('shows a single prerequisite when only one is used', function (done) {

        makeRequest('/fetch2', function (res) {

            expect(res).to.equal('Hello');
            done();
        });
    });

    it('returns error is prerequisite returns error', function (done) {

        makeRequest('/fetch3', function (res) {

            expect(res.code).to.equal(500);
            done();
        });
    });

    it('returns a user record using helper', function (done) {

        makeRequest('/user/5', function (res) {

            expect(res).to.deep.equal({ id: '5' });
            done();
        });
    });

    it('fails on bad helper name', function (done) {

        var test = function () {

            server.route({
                method: 'GET',
                path: '/x/{id}',
                config: {
                    pre: [
                        'xuser(params.id)'
                    ],
                    handler: function () {

                        return this.reply(this.pre.user);
                    }
                }
            });
        };

        expect(test).to.throw('Unknown server helper method in prerequisite string');
        done();
    });

    it('fails on bad method syntax name', function (done) {

        var test = function () {

            server.route({
                method: 'GET',
                path: '/x/{id}',
                config: {
                    pre: [
                        'userparams.id)'
                    ],
                    handler: function () {

                        return this.reply(this.pre.user);
                    }
                }
            });
        };

        expect(test).to.throw('Invalid prerequisite string method syntax');
        done();
    });
});

