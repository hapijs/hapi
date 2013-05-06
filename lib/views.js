// Load modules

var Fs = require('fs');
var Path = require('path');
var Boom = require('boom');
var Defaults = require('./defaults');
var Schema = require('./schema');
var Utils = require('./utils');
// Additional engine modules required in constructor


// Declare internals

var internals = {};


// View Manager

exports = module.exports = internals.Manager = function (options) {

    var self = this;

    var extensions = Object.keys(options.engines);
    Utils.assert(extensions.length, 'Views manager requires at least one registered extension handler');

    var defaults = Utils.applyToDefaults(Defaults.views, options);
    delete defaults.engines;
    delete defaults.defaultExtension;

    this._engines = {};
    this._defaultExtension = options.defaultExtension || (extensions.length === 1 ? extensions[0] : '');

    // Load engines

    extensions.forEach(function (extension) {

        var config = options.engines[extension];
        if (typeof config === 'string') {
            config = { module: config };
        }

        config = Utils.applyToDefaults(defaults, config);
        var schemaError = Schema.view(config);
        Utils.assert(!schemaError, 'Invalid server options:', schemaError);

        var engine = {
            module: (typeof config.module === 'string' ? require(config.module) : config.module),
            config: config,
            suffix: '.' + extension
        };

        Utils.assert(engine.module.compile, 'Invalid view engine module: missing compile()');

        if (config.isCached) {
            engine.cache = {};
        }

        // Load partials

        self._loadPartials(engine);

        // Set engine

        self._engines[extension] = engine;
    });

    return this;
};


internals.Manager.prototype._loadPartials = function (engine) {

    var self = this;

    if (!engine.config.partialsPath ||
        !engine.module.hasOwnProperty('registerPartial')) {

        return;
    }

    var load = function () {

        var path = Path.join(engine.config.basePath || '', engine.config.partialsPath);
        var files = traverse(path);
        files.forEach(function (file) {

            var offset = path.slice(-1) === '/' ? 0 : 1;
            var name = file.slice(path.length + offset, -engine.suffix.length);
            var src = Fs.readFileSync(file).toString(engine.config.encoding);
            engine.module.registerPartial(name, src);
        })
    };

    var traverse = function (path) {

        var files = [];

        Fs.readdirSync(path).forEach(function (file) {

            file = Path.join(path, file);
            var stat = Fs.statSync(file);
            if (stat.isDirectory()) {
                files = files.concat(traverse(file));
                return;
            }

            if (stat.isFile() &&
                Path.basename(file)[0] !== '.' &&
                Path.extname(file) === engine.suffix) {

                files.push(file);
            }
        });

        return files;
    };

    load();
};


internals.Manager.prototype.render = function (filename, context, options, callback) {

    var self = this;

    context = context || {};
    callback = Utils.nextTick(arguments.length === 4 ? arguments[3] : arguments[2]);
    options = (arguments.length === 4 ? arguments[2] : {}) || {};

    var engine = null;

    var fileExtension = Path.extname(filename).slice(1);
    var extension = fileExtension || self._defaultExtension;
    if (!extension) {
        return callback(Boom.internal('Unknown extension and no defaultExtension configured for view template: ' + filename));
    }

    engine = self._engines[extension];
    if (!engine) {
        return callback(Boom.internal('No view engine found for file: ' + filename));
    }

    var settings = Utils.applyToDefaults(engine.config, options);

    this._compile(filename + (fileExtension ? '' : engine.suffix), engine, settings, function (err, compiled) {

        if (err) {
            return callback(err);
        }

        var rendered = null;

        if (!engine.config.layout) {

            // No layout

            try {
                rendered = compiled(context, settings.runtimeOptions);
            }
            catch (err) {
                return callback(Boom.internal(err.message, err));
            }

            return callback(null, rendered, engine.config);
        }

        // With layout

        if (context.hasOwnProperty(engine.config.layoutKeyword)) {

            return callback(Boom.internal('settings.layoutKeyword conflict', { context: context, keyword: engine.config.layoutKeyword }));
        }

        self._compile('layout' + engine.suffix, engine, settings, function (err, layout) {

            if (err) {
                return callback(err);
            }

            var layoutContext = Utils.clone(context);

            try {
                layoutContext[engine.config.layoutKeyword] = compiled(context, settings.runtimeOptions);
                rendered = layout(layoutContext, settings.runtimeOptions);
            }
            catch (err) {
                return callback(Boom.internal(err.message, err));
            }

            return callback(null, rendered, engine.config);
        });
    });
};


internals.Manager.prototype._compile = function (template, engine, settings, callback) {

    if (engine.cache &&
        engine.cache[template]) {

        return callback(null, engine.cache[template]);
    }

    // Validate path

    var isAbsolutePath = (template[0] === '/');
    var isInsecurePath = template.match(/\.\.\//g);

    if (!settings.allowAbsolutePaths &&
        isAbsolutePath) {

        return callback(Boom.internal('Absolute paths are not allowed in views'));
    }

    if (!settings.allowInsecureAccess &&
        isInsecurePath) {

        return callback(Boom.internal('View paths cannot lookup templates outside root path (path includes one or more \'../\')'));
    }

    // Resolve path and extension

    var fullPath = (isAbsolutePath ? template : Path.join(settings.basePath || '', settings.path || '', template));

    settings.compileOptions.filename = fullPath;            // Pass the template to Jade via this copy of compileOptions

    // Read file

    Fs.readFile(fullPath, { encoding: settings.encoding }, function (err, data) {
        
        if (err) {
            return callback(Boom.internal('View file not found: ' + fullPath));
        }

        var compiled = engine.module.compile(data, settings.compileOptions);
        if (engine.cache) {
            engine.cache[template] = compiled;
        }

        return callback(null, compiled);
    });
};


exports.handler = function (route, viewFilePath) {

    return function (request) {

        var context = {
            params: request.params,
            payload: request.payload,
            query: request.query
        };

        request.reply.view(viewFilePath, context);
    };
};
