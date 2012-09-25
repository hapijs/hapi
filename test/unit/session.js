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


    describe('#loadToken', function() {

        it('passes null to the callback when the token is missing', function(done) {
            Session.loadToken('myKey', null, function(session) {
                expect(session).to.not.exist;
                done();
            });
        });

        it('passes null to the callback when the session is expired', function(done) {
            var expiredSession = {
                expiration: Date.now()
            };
            var encryptedSession = Session.encrypt('myKey', expiredSession);

            Session.loadToken('myKey', encryptedSession, function(session) {
                expect(session).to.not.exist;
                done();
            });
        });

        it('passes the session to the callback when the session is valid', function(done) {
            var expiration = new Date(Date.now());
            expiration = expiration.setHours(expiration.getHours() + 1);

            var validSession = {
                expiration: expiration
            };
            var encryptedSession = Session.encrypt('myKey', validSession);

            Session.loadToken('myKey', encryptedSession, function(session) {
                expect(session).to.exist;
                expect(session.expiration).to.equal(validSession.expiration);
                done();
            });
        });
    });
});