// Load modules

var Fs = require('fs');
var Path = require('path');
var Optimist = require('optimist');
var Hoek = require('hoek');
var Hapi = null;                        // Delayed loaded to allow for instrumentation


// Declare internals

var internals = {};


internals.argv = Optimist.usage('Usage: $0 -c manifest.json [-p node_modules_path]')
                    .demand(['c'])
                    .options({
                        require: {
                            string: true,
                            description: 'A module to be required before hapi is loaded'
                        }
                    })
                    .argv;


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
        } else {
            extrasPath = Path.join(nodeModulesPath, extras);
        }
    } else {
        extrasPath = extras;
    }

    try {
        require(extrasPath);
    } catch (err) {
        console.error('Unable to require extra file: %s (%s)', extras, err.message);
        process.exit(1);
    }

    return;
}

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
}


internals.loadPacks = function (manifest, callback) {

    var options = {};

    if (!internals.argv.p) {
        return callback(null, options);
    }

    Fs.realpath(internals.argv.p, function (err, path) {

        if (err) {
            return callback(err);
        }

        options.pack = { requirePath: path };
        callback(null, options);
    });
}


internals.createComposer = function (manifest, options) {

    var attached = !!internals.composer;                                                // When composer exists events are already attached.
    internals.composer = new Hapi.Composer(manifest, options);

    internals.composer.compose(function (err) {

        Hoek.assert(!err, 'Failed loading plugins: ' + (err && err.message));
        internals.composer.start(function (err) {

            Hoek.assert(!err, 'Failed starting server: ' + (err && err.message));

            if (!attached) {
                internals.attachEvents();
            }
        });
    });
};


internals.attachEvents = function () {

    process.once('SIGQUIT', internals.stop);                                             // Use kill -s QUIT {pid} to kill the servers gracefully
    process.on('SIGUSR2', internals.restart);                                            // Use kill -s SIGUSR2 {pid} to restart the servers
};


internals.stop = function () {

    internals.composer.stop(function () {

        process.exit(0);
    });
};


internals.restart = function () {

    console.log('Stopping...');
    internals.composer.stop(function () {

        console.log('Starting...');
        internals.start();
    });
};


exports.start = function () {

    internals.loadExtras();
    Hapi = require('..')
    var manifest = internals.getManifest();
    internals.loadPacks(manifest, function (err, options) {

        if (err) {
            console.error(err);
            process.exit(1);
        }

        internals.createComposer(manifest, options);
    });
};
