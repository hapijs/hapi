// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Memory = require(libPath + 'cache/memory');
var Cache = require(libPath + 'cache');
var Defaults = require(libPath + 'defaults');


describe('Memory Cache', function () {

    describe('#Connection', function () {

        it('throws an error when constructed without new', function (done) {

            var fn = function () {

                var memory = Memory.Connection();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('constructs a new Connection when constructed with new', function (done) {

            var fn = function () {

                var memory = new Memory.Connection();
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#start', function () {

        it('creates an empty cache object', function (done) {

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;
            memory.start(function () {

                expect(memory.cache).to.exist;
                done();
            });
        });
    });

    describe('#stop', function () {

        it('sets the cache object to null', function (done) {

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;
            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.stop();
                expect(memory.cache).to.not.exist;
                done();
            });
        });
    });

    describe('#set', function () {

        it('adds an item to the cache object', function (done) {

            var key = {
                segment: 'test',
                id: 'test'
            };

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;

            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.set(key, 'myvalue', 10, function () {

                    expect(memory.cache[key.segment][key.id].item).to.equal('myvalue');
                    done();
                });
            });
        });

        it('removes an item from the cache object when it expires', function (done) {

            var key = {
                segment: 'test',
                id: 'test'
            };

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;

            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.set(key, 'myvalue', 10, function () {

                    expect(memory.cache[key.segment][key.id].item).to.equal('myvalue');
                    setTimeout(function () {

                        expect(memory.cache[key.segment][key.id]).to.not.exist;
                        done();
                    }, 15);
                });
            });
        });

        it('returns an error when the maxByteSize has been reached', function (done) {

            var key = {
                segment: 'test',
                id: 'test'
            };

            var memory = new Memory.Connection({ maxByteSize: 4 });
            expect(memory.cache).to.not.exist;

            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.set(key, 'myvalue', 10, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });
        });

        it('increments the byte size when an item is inserted and returns an error when the limit is reached', function (done) {

            var key1 = {
                segment: 'test',
                id: 'test'
            };

            var key2 = {
                segment: 'test',
                id: 'test2'
            };

            var memory = new Memory.Connection({ maxByteSize: 6 });
            expect(memory.cache).to.not.exist;

            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.set(key1, 'my', 10, function () {

                    expect(memory.cache[key1.segment][key1.id].item).to.equal('my');

                    memory.set(key2, 'myvalue', 10, function (err) {

                        expect(err).to.exist;
                        done();
                    });
                });
            });
        });

        it('increments the byte size when an object is inserted', function (done) {

            var key1 = {
                segment: 'test',
                id: 'test'
            };
            var itemToStore = {
                my: {
                    array: [1, 2, 3],
                    date: new Date(Date.now()),
                    bool: true,
                    string: 'test'
                }
            };

            var memory = new Memory.Connection({ maxByteSize: 2000 });
            expect(memory.cache).to.not.exist;

            memory.start(function () {

                expect(memory.cache).to.exist;
                memory.set(key1, itemToStore, 10, function () {
                    expect(memory.cache[key1.segment][key1.id].byteSize).to.equal(66);
                    expect(memory.cache[key1.segment][key1.id].item.my).to.exist;
                    done();
                });
            });
        });
    });
});