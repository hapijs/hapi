// Load modules

var Chai = require('chai');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Composer', function () {

    it('composes pack', function (done) {

        var options = {
            servers: {
                ren: {
                    port: 0,
                    labels: ['api', 'nasty'],
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
                furball: {
                    version: false,
                    plugins: '/'
                }
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

                composer.packs[0].servers[0].inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.deep.equal([{ "name": "furball", "version": "0.0.7" }]);
                    done();
                });
            });
        });
    });
});
