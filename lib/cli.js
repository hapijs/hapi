// Load modules

var Fs = require('fs');
var Path = require('path');
var Bossy = require('bossy');
var Hoek = require('hoek');
var Hapi = null;                        // Delayed loaded to allow for instrumentation


// Declare internals

var internals = {};


internals.definition = {
    c: {
        description: "Manifest json file",
        require: true
    },
    p: {
        description: "node_nodules path"
    },
    r: {
        alias: 'require',
        description: 'A module to be required before hapi is loaded'
    },
    h: {
        alias: 'help',
        description: 'Show help',
        type: 'boolean'
    }
};


internals.loadExtras = function () {

    var extras = internals.argv.require;

    if (!extras) {
        return;
    }

    var extrasPath;
    var nodeModulesPath = Path.join(process.cwd(), 'node_modules');

    if (internals.argv.p) {
        nodeModulesPath = Path.join(Fs.realpathSync(internals.argv.p), 'node_modules');
    }

    if (!Hoek.isAbsolutePath(extras)) {
        if (extras[0] === '.') {
            extrasPath = Path.join(process.cwd(), extras)
        }
        else {
            extrasPath = Path.join(nodeModulesPath, extras);
        }
    }
    else {
        extrasPath = extras;
    }

    try {
        require(extrasPath);
    } catch (err) {
        console.error('Unable to require extra file: %s (%s)', extras, err.message);
        process.exit(1);
    }
};


internals.getManifest = function () {

    var manifest = null;
    var manifestPath = !Hoek.isAbsolutePath(internals.argv.c) ? Path.join(process.cwd(), internals.argv.c) : internals.argv.c;

    try {
        manifest = JSON.parse(Fs.readFileSync(manifestPath));
    }
    catch (err) {
        console.log('Failed loading configuration file: ' + internals.argv.c + ' (' + err.message + ')');
        process.exit(1);
    }

    return manifest;
};


internals.loadPacks = function (manifest, callback) {

    var options = {};

    if (!internals.argv.p) {
        return callback(null, options);
    }

    Fs.realpath(internals.argv.p, function (err, path) {

        if (err) {
            return callback(err);
        }

        options = { relativeTo: path };
        callback(null, options);
    });
};


exports.start = function () {

    var args = Bossy.parse(internals.definition);

    if (args instanceof Error) {
        console.error(Bossy.usage(internals.definition, 'hapi -c manifest.json [-p node_modules_path -r pre_load_module]'));
        process.exit(1);
    }

    if (args.h) {
        console.log(Bossy.usage(internals.definition, 'hapi -c manifest.json [-p node_modules_path -r pre_load_module]'));
        process.exit(1);
    }

    internals.argv = args;


    internals.loadExtras();
    Hapi = require('..');
    var manifest = internals.getManifest();

    internals.loadPacks(manifest, function (err, options) {

        if (err) {
            console.error(err);
            process.exit(1);
        }

        Hapi.Pack.compose(manifest, options, function (err, pack) {

            Hoek.assert(!err, 'Failed loading plugins: ' + (err && err.message));

            pack.start(function (err) {

                Hoek.assert(!err, 'Failed starting server: ' + (err && err.message));

                // Use kill -s QUIT {pid} to kill the servers gracefully

                process.once('SIGQUIT', function () {

                    pack.stop(function () {

                        process.exit(0);
                    });
                });

                // Use kill -s SIGUSR2 {pid} to restart the servers

                process.on('SIGUSR2', function () {

                    console.log('Stopping...');
                    pack.stop(function () {

                        console.log('Starting...');
                        internals.start();
                    });
                });
            });
        });
    });
};
