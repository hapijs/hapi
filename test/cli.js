// Load modules

var ChildProcess = require('child_process');
var Fs = require('fs');
var Os = require('os');
var Path = require('path');
var Crypto = require('crypto');
var Lab = require('lab');
var Hapi = require('..');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;


internals.uniqueFilename = function (path) {

    var name = [Date.now(), process.pid, Crypto.randomBytes(8).toString('hex')].join('-');
    return Path.join(path, name);
};


describe('Hapi command line', function () {

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

        var configPath = internals.uniqueFilename(Os.tmpDir());
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

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });
    });

    it('composes pack with absolute path using symlink', { skip: process.platform === 'win32' }, function (done) {

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

        var configPath = internals.uniqueFilename(Os.tmpDir());
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, 'pack');
        var symlinkPath = internals.uniqueFilename(Os.tmpDir());

        Fs.symlinkSync(modulePath, symlinkPath, 'dir');
        Fs.writeFileSync(configPath, JSON.stringify(manifest));

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', symlinkPath]);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.equal('loaded\n');
            hapi.kill();

            Fs.unlinkSync(configPath);
            Fs.unlinkSync(symlinkPath);

            done();
        });

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });
    });

    it('fails when path cannot be resolved', function (done) {

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

        var configPath = internals.uniqueFilename(Os.tmpDir());
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');

        Fs.writeFileSync(configPath, JSON.stringify(manifest));

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', 'somethingWrong']);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.contain('ENOENT');

            hapi.kill();

            Fs.unlinkSync(configPath);

            done();
        });
    });

    it('errors when it cannot require the extra module', function (done) {

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

        var configPath = internals.uniqueFilename(Os.tmpDir());
        var extraPath = 'somecoolmodule';
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, 'pack');

        Fs.writeFileSync(configPath, JSON.stringify(manifest));

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', modulePath, '--require', extraPath]);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.contain('Cannot find module');

            hapi.kill();

            Fs.unlinkSync(configPath);

            done();
        });
    });
    it('errors when it cannot require the extra module from absolute path', function (done) {

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

        var configPath = internals.uniqueFilename(Os.tmpDir());
        var extraPath = internals.uniqueFilename(Os.tmpDir());
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, 'pack');

        Fs.writeFileSync(configPath, JSON.stringify(manifest));

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', modulePath, '--require', extraPath]);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.contain('Cannot find module');

            hapi.kill();

            Fs.unlinkSync(configPath);

            done();
        });
    });

    it('loads extra modules as intended', function (done) {

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

        var extra = "console.log('test passed')";

        var configPath = internals.uniqueFilename(Os.tmpDir());
        var extraPath = internals.uniqueFilename(Os.tmpDir());
        var hapiPath = Path.join(__dirname, '..', 'bin', 'hapi');
        var modulePath = Path.join(__dirname, 'pack');

        Fs.writeFileSync(configPath, JSON.stringify(manifest));
        Fs.writeFileSync(extraPath, extra);

        var hapi = ChildProcess.spawn('node', [hapiPath, '-c', configPath, '-p', modulePath, '--require', extraPath]);

        hapi.stdout.on('data', function (data) {

            expect(data.toString()).to.equal('test passed\n');
            hapi.kill();

            Fs.unlinkSync(configPath);
            Fs.unlinkSync(extraPath);

            done();
        });

        hapi.stderr.on('data', function (data) {

            expect(data.toString()).to.not.exist;
        });
    });
});
