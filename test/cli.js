// Load modules

var ChildProcess = require('child_process');
var Fs = require('fs');
var Os = require('os');
var Path = require('path');
var Code = require('code');
var Lab = require('lab');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('bin/hapi', function () {

    it('composes pack with absolute path', function (done) {

        var manifest = {
            pack: {
                cache: {
                    engine: 'catbox-memory'
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
                './--loaded': {}
            }
        };

        var configPath = Hoek.uniqueFilename(Os.tmpDir());
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, 'pack');

        Fs.writeFileSync(configPath, JSON.stringify(manifest));

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', modulePath]);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.equal('loaded\n');
            hapi.kill();
            Fs.unlinkSync(configPath);

            done();
        });

        hapi.stderr.once('data', function (data) {

            expect(data.toString()).to.not.exist();
        });
    });
});
