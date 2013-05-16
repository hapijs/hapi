// Load modules

var ChildProcess = require('child_process');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Hapi command line', function () {

    it('composes pack without plugins', function (done) {

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
            ]
        };

        var configPath = Path.join(__dirname, 'manifest.json');
        var hapiPath = Path.join(__dirname, '..', '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, '..', '..');

        if (!Fs.existsSync(configPath)) {
            Fs.writeFileSync(configPath, JSON.stringify(manifest));
        }

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', modulePath]);

        hapi.stderr.on('data', function (data) {

            expect(data).to.not.exist;
        });

        hapi.on('close', function (code) {

            expect(code).to.equal(0);
            hapi.kill();

            if (Fs.existsSync(configPath)) {
                Fs.unlinkSync(configPath);
            }

            done();
        });
    });
});
