// Load modules

var Fs = require('fs');
var Path = require('path');
var Defaults = require('./defaults');
var Utils = require('./utils');
var Boom = require('boom');
// Additional engine modules required in constructor


// Declare internals

var internals = {};

// Engines Manager

internals.Engines = function (options) {

    this.settings = options || {};
    this._engines = {};
};


internals.Engines.prototype.add = function (settings, key) {

    key = key || settings.extension || null;

    Utils.assert(settings.module, 'Engine.module must be defined');
    Utils.assert(key, 'Engine.extension must be defined');

    if (typeof settings.module === 'string') {
        try {
            this._engines[key] = require(settings.module);  // Can only require modules from hapi's package.json
        }
        catch (e) {
            Utils.assert(false, 'Engine.module (' + settings.module + ') must be installed');
        }
    }
    else {
        this._engines[key] = settings.module;
    }
    this._engines[key].suffix = '.' + key;

    // Generalize engine support via map object

    var funcs = Object.keys(settings.map);
    for (var i = 0, il = funcs.length; i < il; ++i) {
        if (settings.map.hasOwnProperty(funcs[i])) {
            this._engines[key][funcs[i]] = settings.map[funcs[i]](this._engines[key]);
        }
    }

    return this._engines[key];
};


internals.Engines.prototype.getExt = function (p) {

    if (p.indexOf('.') >= 0) {
        p = Path.extname(p).slice(1);
    }

    return p;
};


internals.Engines.prototype.get = function (extension) {

    return this._engines[this.getExt(extension)];
};


// View Manager

exports = module.exports = internals.Manager = function (options) {

    this.settings = this.mergeLeft(Defaults.views, options);

    Utils.assert(!this.settings.partials || this.settings.partials.path, 'Missing partials path');

    this.engines = new internals.Engines();                             // Multiple engine support (distinguished by extension)
    this.engineLookup = {};                                             // For quickly looking up engines by filename
    this._cache = {};                                                   // Compiled templates cache

    this.loadEngines();
    this.loadPartials();

    return this;
};


internals.Manager.prototype.mergeLeft = function () {

    var args = Array.prototype.slice.call(arguments);
    var base = Utils.clone(args.shift());

    args.forEach(function (el, i, arr) {

        for (var key in el) {
            base[key] = el[key];
        }
    });
    return base;
};


internals.Manager.prototype.loadEngines = function () {

    this.settings.engines = this.settings.engines || {};

    // Support API backwards compatibility

    if (this.settings.engine) {
        this.settings.engines[this.settings.engine.extension || Defaults.views.engines.html.extension] = this.settings.engine;
        delete this.settings.engine;
    }

    // Load all engines

    var engines = Object.keys(this.settings.engines);
    for (var i = 0, il = engines.length; i < il; ++i) {
        var key = engines[i];
        var engine = this.settings.engines[key];
        if (!engine.extension) {
            engine.extension = key;
        }

        // Merge Base

        var base = Utils.clone(Defaults.views.engines.html);
        var baseMethods = Object.keys(base);
        for (var j = 0, jl = baseMethods.length; j < jl; ++j) {
            var method = baseMethods[j];
            if (!engine.hasOwnProperty(method)) {
                engine[method] = base[method];
            }
        }

        this.engines.add(engine);
    }
};


internals.Manager.prototype.execute = function (engine, compiled, ctx, options) {

    if (engine && engine.hasOwnProperty('execute') && typeof engine.execute === 'function') {
        return engine.execute(engine, compiled, ctx, options);
    }

    return compiled;
};


internals.Manager.prototype.render = function (filename, context, options) {

    var template = filename;
    if (typeof template === 'string') {
        template = this._get(template, options);
        if (template instanceof Error) {
            return template;
        }
    }

    var engine = this.engines.get(this.engineLookup[filename]);

    if (!this.settings.layout) {

        // No layout

        try {
            return this.execute(engine, template, context, options)(context, options);
        }
        catch (err) {
            return Boom.internal(err.message, err);
        }
    }

    // With layout

    if (context &&
        context.hasOwnProperty(this.settings.layoutKeyword)) {

        return Boom.internal('settings.layoutKeyword conflict', { context: context, keyword: this.settings.layoutKeyword });
    }

    var layout = this._get('layout', options);
    if (layout instanceof Error) {
        return layout;
    }

    var layoutContext = Utils.clone(context);

    try {
        layoutContext[this.settings.layoutKeyword] = this.execute(engine, template, context, options)(context);
        return this.execute(engine, layout, layoutContext, options)(layoutContext);
    }
    catch (err) {
        return Boom.internal(err.message, err);
    }
};


internals.Manager.prototype._isCaching = function (filename, globalSettings, engineSettings, set) {

    set = set || false;
    engineSettings = this.mergeLeft(Defaults.views.engines.html, engineSettings || {});

    if (globalSettings.cache === false) {
        return false; // if global cache disabled, disable all caching behavior
    }

    if (engineSettings.cache === false) {
        return false; // if engine cache disabled, disable this request
    }

    if (set) {
        return true;
    }

    return this._cache.hasOwnProperty(filename); // Cache enabled only if key exists
};


internals.Manager.prototype.getCache = function (filename) {

    return this._cache[filename];
};


internals.Manager.prototype.setCache = function (filename, compiled, options, engineSettings) {

    if (this._isCaching(filename, options, engineSettings, true)) {
        return this._cache[filename] = compiled;
    }
};


internals.Manager.prototype._get = function (filename, options) {

    options = this.mergeLeft(this.settings, options);

    if (this._isCaching(filename, options)) {
        return this.getCache(filename);
    }

    // Normalize path

    var isAbsolutePath = (filename[0] === '/');
    var isInsecurePath = filename.match(/\.\.\//g) !== null;

    if (!options.allowAbsolutePaths &&
        isAbsolutePath) {

        return Boom.internal('Absolute paths are not allowed in views');
    }

    if (!options.allowInsecureAccess &&
        isInsecurePath) {

        return Boom.internal('View paths cannot lookup templates outside root path (path includes one or more \'../\')');
    }

    // Resolve path and extension

    var fullPath = filename;
    if (!isAbsolutePath) {
        fullPath = Path.join(options.basePath, options.path, fullPath);
    }

    var folder = Path.dirname(fullPath);
    var files = Fs.readdirSync(folder);
    var re = new RegExp(Path.basename(filename) + '([.][a-zA-Z0-9]+)?$');

    for (var j = 0, jl = files.length; j < jl; ++j) {
        var match = re.exec(files[j]);
        if (match) {
            fullPath = Path.join(folder, files[j]);
            break;
        }
    }

    // Pass the filename to Jade via this copy of compileOptions

    options.compileOptions.filename = fullPath;

    // Read file

    try {
        var source = Fs.readFileSync(fullPath).toString(this.settings.encoding);
    }
    catch (e) {
        return Boom.internal('View file not found: ' + fullPath);
    }

    var engine = this.engines.get(fullPath);
    var compiled = engine.compile(source, options.compileOptions);
    this.engineLookup[filename] = engine.suffix.slice(1);

    this.setCache(filename, compiled, options, this.settings.engines[engine.suffix.slice(1)]);

    return compiled;
};


internals.Manager.prototype.loadPartials = function () {

    var self = this;

    if (!this.settings.partials) {
        return;
    }

    var path = Path.join(this.settings.basePath, this.settings.partials.path);

    var load = function (root, currentPath, files) {

        var current = Path.join(root, currentPath);
        if (!Fs.statSync(current).isDirectory()) {
            try {
                var engine = self.engines.get(current);
                if (current.slice(-engine.suffix.length) === engine.suffix) {
                    files.push(current);
                }
            }
            catch (e) {
                // Skip file
            }

            return register(files);
        }

        var directory = Fs.readdirSync(current);
        for (var i = 0, il = directory.length; i < il; ++i) {
            var currentFile = directory[i];
            var currentFileFullPath = Path.join(root, currentFile);
            if (Fs.statSync(currentFileFullPath).isDirectory()) {
                load(currentFileFullPath, '/', files);
            }
            else {
                load(root, currentFile, files);
            }
        }

        return register(files);
    };

    var register = function (files) {

        for (var i = 0, il = files.length; i < il; ++i) {
            var file = files[i];
            var engine = self.engines.get(file);
            if (!engine.hasOwnProperty('registerPartial')) {
                continue;
            }

            var offset = path.slice(-1) === '/' ? 0 : 1;
            var name = file.slice(path.length + offset, -engine.suffix.length);
            var src = Fs.readFileSync(file).toString(self.settings.encoding);
            engine.registerPartial(name, src);
        }
    };

    load(path, '/', []);
};


exports.handler = function (route, viewFilePath) {

    return function (request) {

        var context = {
            params: request.params,
            payload: request.payload,
            querystring: request.querystring
        };

        request.reply.view(viewFilePath, context).send();
    };
};
