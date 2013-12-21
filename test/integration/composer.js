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

        var manifest = {
            pack: {
                cache: {
                    engine: 'memory'
                },
                app: {
                    my: 'special-value'
                }
            },
            servers: [
                {
                    port: 0,
                    options: {
                        labels: ['api', 'nasty', 'test']
                    }
                },
                {
                    host: 'localhost',
                    port: 0,
                    options: {
                        labels: ['api', 'nice']
                    }
                }
            ],
            plugins: {
                '../test/integration/pack/--test1': [ { ext: true }, {} ]
            }
        };

        var composer = new Hapi.Composer(manifest);
        composer.compose(function (err) {

            expect(err).to.not.exist;
            composer.start(function (err) {

                expect(err).to.not.exist;
                composer.stop(function () {

                    composer._packs[0]._servers[0].inject({ method: 'GET', url: '/test1' }, function (res) {

                        expect(res.result).to.equal('testing123special-value');
                        done();
                    });
                });
            });
        });
    });

    it('composes pack (env)', function (done) {

        var manifest = {
            pack: {
                cache: {
                    engine: 'memory'
                }
            },
            servers: [
                {
                    port: '$env.hapi_port',
                    options: {
                        labels: ['api', 'nasty', 'test']
                    }
                },
                {
                    host: '$env.hapi_host',
                    port: 0,
                    options: {
                        labels: ['api', 'nice']
                    }
                }
            ],
            plugins: {
                '../test/integration/pack/--test1': {}
            }
        };

        process.env.hapi_port = '0';
        process.env.hapi_host = 'localhost';

        var composer = new Hapi.Composer(manifest);
        composer.compose(function (err) {

            expect(err).to.not.exist;
            composer.start(function (err) {

                expect(err).to.not.exist;
                composer.stop();

                composer._packs[0]._servers[0].inject({ method: 'GET', url: '/test1' }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });
    });
});
