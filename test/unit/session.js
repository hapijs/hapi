// Load modules

var expect = require('chai').expect;
var Session = process.env.TEST_COV ? require('../../lib-cov/session') : require('../../lib/session');


describe('Session', function() {

    describe('#encrypt', function() {

        it('changes the value and is decrypted correctly', function(done) {
            var encrypted = Session.encrypt('myKey', 'testValue');
            var decrypted = Session.decrypt('myKey', encrypted);

            expect(encrypted).to.not.equal('testValue');
            expect(decrypted).to.equal('testValue');
            done();
        });
    });


    describe('#getRandomString', function() {

        it('returns a string with the expected length', function(done) {
            var result = Session.getRandomString(12);

            expect(result).to.exist;
            expect(result.length).to.equal(12);
            done();
        });
    });
});