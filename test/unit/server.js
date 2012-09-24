// Load modules

var expect = require('chai').expect;
var Server = require('../../lib/server');

describe('Server', function() {

    it('throws an error constructed without new', function(done) {
        var fn = function() {
            Server('0.0.0.0', 8086, {});
        };
        expect(fn).throws(Error, 'Server must be instantiated using new');
        done();
    });

    it('throws an error when no host is provided', function(done) {
        var fn = function() {
            var server = new Server();
        };
        expect(fn).throws(Error, 'Host must be provided');
        done();
    });

    it('throws an error when no port is provided', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0');
        };
        expect(fn).throws(Error, 'Port must be provided');
        done();
    });

    it('doesn\'t throw an error when host and port are provided', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8087);
        };
        expect(fn).to.not.throw(Error);
        done();
    });
});