// Load modules

var Fs = require('fs');
var Path = require('path');
var Boom = require('boom');
var Defaults = require('./defaults');
var Schema = require('./schema');
var Utils = require('./utils');
var Response = require('./response');
var Schema = require('./schema');
// Additional engine modules required in constructor


// Declare internals

var internals = {};


// View Manager

exports.Manager = internals.Manager = function (options, requireFunc) {

    var self = this;

    requireFunc = requireFunc || require;

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

        // Prevent module from being cloned

        var module = null;
        if (typeof config.module === 'object') {
            module = config.module;
            config.module = null;
        }

        config = Utils.applyToDefaults(defaults, config);

        if (module) {
            config.module = module;
        }

        var schemaError = Schema.view(config);
        Utils.assert(!schemaError, 'Invalid server options:', schemaError);

        var engine = {
            module: (typeof config.module === 'string' ? requireFunc(config.module) : config.module),
            config: config,
            suffix: '.' + extension
        };

        Utils.assert(engine.module.compile, 'Invalid view engine module: missing compile()');

        engine.compileFunc = engine.module.compile;
        if (config.compileMode === 'sync') {
            engine.compileFunc = function (str, opt, next) {

                var compiled = null;
                try {
                    compiled = engine.module.compile(str, opt);
                }
                catch (err) {
                    return next(err);
                }

                var renderer = function (context, runtimeOptions, renderNext) {

                    var rendered = null;
                    try {
                        rendered = compiled(context, runtimeOptions);
                    }
                    catch (err) {
                        return renderNext(err);
                    }

                    renderNext(null, rendered);
                };

                next(null, renderer);
            };
        }

        if (config.isCached) {
            engine.cache = {};
        }

        // Load partials and helpers

        self._loadPartials(engine);
        self._loadHelpers(engine);

        // Set engine

        self._engines[extension] = engine;
    });
};


internals.Manager.prototype._loadPartials = function (engine) {

    var self = this;

    if (!engine.config.partialsPath ||
        !engine.module.registerPartial ||
        typeof engine.module.registerPartial !== 'function') {

        return;
    }

    var load = function () {

        var path = internals.path(engine.config.basePath, engine.config.partialsPath);
        var files = traverse(path);
        files.forEach(function (file) {

            var offset = path.slice(-1) === Path.sep ? 0 : 1;
            var name = file.slice(path.length + offset, -engine.suffix.length).replace('\\', '/');
            var src = Fs.readFileSync(file).toString(engine.config.encoding);
            engine.module.registerPartial(name, src);
        });
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

            if (Path.basename(file)[0] !== '.' &&
                Path.extname(file) === engine.suffix) {

                files.push(file);
            }
        });

        return files;
    };

    load();
};


internals.Manager.prototype._loadHelpers = function (engine) {

    var self = this;

    if (!engine.config.helpersPath ||
        !engine.module.registerHelper ||
        typeof engine.module.registerHelper !== 'function') {

        return;
    }

    var path = internals.path(engine.config.basePath, engine.config.helpersPath);
    if (!Utils.isAbsolutePath(path)) {
        path = Path.join(process.cwd(), path);
    }

    Fs.readdirSync(path).forEach(function (file) {

        file = Path.join(path, file);
        var stat = Fs.statSync(file);
        if (!stat.isDirectory() &&
            Path.basename(file)[0] !== '.') {

            try {
                var helper = require(file);
                if (typeof helper === 'function') {
                    var offset = path.slice(-1) === '/' ? 0 : 1;
                    var name = file.slice(path.length + offset, -3);
                    engine.module.registerHelper(name, helper);
                }
            }
            catch (err) { }
        }
    });
};


internals.Manager.prototype.render = function (filename, context, options, callback) {

    var self = this;

    context = context || {};
    options = options || {};

    var engine = null;

    var fileExtension = Path.extname(filename).slice(1);
    var extension = fileExtension || self._defaultExtension;
    if (!extension) {
        return callback(Boom.badImplementation('Unknown extension and no defaultExtension configured for view template: ' + filename));
    }

    engine = self._engines[extension];
    if (!engine) {
        return callback(Boom.badImplementation('No view engine found for file: ' + filename));
    }

    var settings = Utils.applyToDefaults(engine.config, options);

    var templatePath = this._path(filename + (fileExtension ? '' : engine.suffix), settings);
    if (templatePath.isBoom) {
        return callback(templatePath);
    }

    this._compile(templatePath, engine, settings, function (err, compiled) {

        if (err) {
            return callback(err);
        }

        // No layout

        if (!settings.layout) {
            compiled(context, settings.runtimeOptions, function (err, rendered) {

                if (err) {
                    return callback(Boom.badImplementation(err.message, err));
                }

                return callback(null, rendered, settings);
            });

            return;
        }

        // With layout

        if (context.hasOwnProperty(settings.layoutKeyword)) {
            return callback(Boom.badImplementation('settings.layoutKeyword conflict', { context: context, keyword: settings.layoutKeyword }));
        }

        var layoutPath = self._path((settings.layout === true ? 'layout' : settings.layout) + engine.suffix, settings, true);
        if (layoutPath.isBoom) {
            return callback(layoutPath);
        }

        self._compile(layoutPath, engine, settings, function (err, layout) {

            if (err) {
                return callback(err);
            }

            var layoutContext = Utils.clone(context);

            compiled(context, settings.runtimeOptions, function (err, rendered) {

                if (err) {
                    return callback(Boom.badImplementation(err.message, err));
                }

                layoutContext[settings.layoutKeyword] = rendered;

                layout(layoutContext, settings.runtimeOptions, function (err, rendered) {

                    if (err) {
                        return callback(Boom.badImplementation(err.message, err));
                    }

                    return callback(null, rendered, settings);
                });
            });
        });
    });
};


internals.Manager.prototype._path = function (template, settings, isLayout) {

    // Validate path

    var isAbsolutePath = Utils.isAbsolutePath(template);
    var isInsecurePath = template.match(/\.\.\//g);

    if (!settings.allowAbsolutePaths &&
        isAbsolutePath) {

        return Boom.badImplementation('Absolute paths are not allowed in views');
    }

    if (!settings.allowInsecureAccess &&
        isInsecurePath) {

        return Boom.badImplementation('View paths cannot lookup templates outside root path (path includes one or more \'../\')');
    }

    // Resolve path and extension

    return (isAbsolutePath ? template : internals.path(settings.basePath, (isLayout && settings.layoutPath) || settings.path, template));
};


internals.path = function (base, path, file) {

    if (path &&
        Utils.isAbsolutePath(path)) {

        return Path.join(path, file || '');
    }

    return Path.join(base || '', path || '', file || '');
};


internals.Manager.prototype._compile = function (template, engine, settings, callback) {

    if (engine.cache &&
        engine.cache[template]) {

        return callback(null, engine.cache[template]);
    }

    settings.compileOptions.filename = template;            // Pass the template to Jade via this copy of compileOptions

    // Read file

    Fs.readFile(template, { encoding: settings.encoding }, function (err, data) {

        if (err) {
            return callback(Boom.badImplementation('View file not found: ' + template));
        }

        engine.compileFunc(data, settings.compileOptions, function (err, compiled) {

            if (err) {
                return callback(Boom.wrap(err));
            }

            if (engine.cache) {
                engine.cache[template] = compiled;
            }

            return callback(null, compiled);
        });
    });
};


exports.handler = function (route, options) {

    Schema.assert('view handler', options, route.path);

    if (typeof options === 'string') {
        options = { template: options };
    }

    var settings = {                                // Shallow copy to allow making dynamic changes to context
        template: options.template,
        context: options.context
    };

    return function (request, reply) {

        var context = settings.context;
        if (!context) {
            context = {
                params: request.params,
                payload: request.payload,
                query: request.query,
                pre: request.pre
            };
        }

        reply.view(settings.template, context);
    };
};


exports.Response = internals.Response = function (manager, template, context, options, request) {

    var source = {
        manager: manager,
        template: template,
        context: context,
        options: options
    };

    Response.Plain.call(this, source, request, 'view');
};

Utils.inherits(internals.Response, Response.Plain);


internals.Response.prototype._marshall = function (request, next) {

    var self = this;

    this.source.manager.render(this.source.template, this.source.context, this.source.options, function (err, rendered, config) {

        if (err) {
            return next(err);
        }

        self._payload = new Response.Payload(rendered, self.settings);
        self.type(config.contentType);
        self.encoding(config.encoding);

        return next();
    });
};

