// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Memory = require(libPath + 'cache/memory');


describe('Memory Cache', function() {

    describe('#Connection', function() {

        it('throws an error when constructed without new', function(done) {

            var fn = function() {

                var memory = Memory.Connection();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('constructs a new Connection when constructed with new', function(done) {

            var fn = function() {

                var memory = new Memory.Connection();
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#start', function() {

        it('creates an empty cache object', function(done) {

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;
            memory.start(function() {

                expect(memory.cache).to.exist;
                done();
            });
        });
    });

    describe('#stop', function() {

        it('sets the cache object to null', function(done) {

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;
            memory.start(function() {

                expect(memory.cache).to.exist;
                memory.stop();
                expect(memory.cache).to.not.exist;
                done();
            });
        });
    });

    describe('#set', function() {

        it('adds an item to the cache object', function(done) {

            var key = {
                segment: 'test',
                id: 'test'
            };

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;

            memory.start(function() {

                expect(memory.cache).to.exist;
                memory.set(key, 'myvalue', 10, function() {

                    expect(memory.cache[key.segment][key.id].item).to.equal('myvalue');
                    done();
                });
            });
        });

        it('removes an item from the cache object when it expires', function(done) {

            var key = {
                segment: 'test',
                id: 'test'
            };

            var memory = new Memory.Connection();
            expect(memory.cache).to.not.exist;

            memory.start(function() {

                expect(memory.cache).to.exist;
                memory.set(key, 'myvalue', 10, function() {

                    expect(memory.cache[key.segment][key.id].item).to.equal('myvalue');
                    setTimeout(function() {

                        expect(memory.cache[key.segment][key.id]).to.not.exist;
                        done();
                    }, 15);
                });
            });
        });
    });
});