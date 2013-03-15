// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Composer', function () {

    it('composes pack', function (done) {

        var options = {
            servers: {
                ren: {
                    port: 0,
                    labels: ['api', 'nasty', 'test'],
                    config: {
                        cache: 'memory'
                    }
                },
                stimpy: {
                    host: 'localhost',
                    port: 0,
                    labels: ['api', 'nice']
                }
            },
            plugins: {
                '../test/integration/pack/--test1': { }
            },
            permissions: {
                ext: true
            }
        };

        var composer = new Hapi.Composer(options);
        composer.compose(function (err) {

            expect(err).to.not.exist;
            composer.start(function (err) {

                expect(err).to.not.exist;
                composer.stop();

                composer.packs[0].servers[0].inject({ method: 'GET', url: '/test1' }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });
    });
});
