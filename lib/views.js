// Load modules

var Fs = require('fs');
var Path = require('path');
var Defaults = require('./defaults');
var Utils = require('./utils');
var Err = require('./error');
// Additional engine modules required in constructor


// Declare internals

var internals = {};

// Engines Manager

internals.Engines = function (options) {

    this.settings = options || {};
    this._e = {};
};


internals.Engines.prototype.add = function (settings, key) {

    key = key || settings.extension || null;
    
    Utils.assert(settings.module, 'Engine.module must be defined');
    Utils.assert(key, 'Engine.extension must be defined');
    
    this._e[key] = require(settings.module);
    this._e[key].suffix = '.' + key;
    
    // Generalize engine support via map object
    
    var funcs = Object.keys(settings.map);
    for(var i = 0, il = funcs.length; i < il; ++i) {
        if (settings.map.hasOwnProperty(funcs[i])) {
            this._e[key][funcs[i]] = settings.map[funcs[i]](this._e[key]);
        }
    }
    
    return this._e[key];
};


internals.Engines.prototype.getExt = function (p) {

    if (p.indexOf('.') >= 0) {
        p = Path.extname(p).slice(1);
    }
    
    return p;
};


internals.Engines.prototype.get = function (extension) {

    return this._e[this.getExt(extension)];
};


internals.Engines.prototype.keys = function () {

    return Object.keys(this._e);
};


// View Manager


exports = module.exports = internals.Manager = function (options) {

    this.settings = Utils.applyToDefaults(Defaults.views, options);

    Utils.assert(!this.settings.partials || this.settings.partials.path, 'Missing partials path');

    this.engines = new internals.Engines();                             // Multiple engine support (distinguished by extension)
    this._cache = {};                                                   // Compiled templates cache

    this.loadEngines();
    this.loadPartials();

    return this;
};


internals.Manager.prototype.loadEngines = function () {

    this.settings.engines = this.settings.engines || {};
    
    // Support API backwards compatibility
    
    if (this.settings.engine) {
        this.settings.engines[this.settings.engine.extension || Defaults.views.engine.extension] = this.settings.engine;
        delete this.settings.engine;
    }
    
    // Load all engines
    
    var engines = Object.keys(this.settings.engines);
    for(var i = 0, il = engines.length; i < il; ++i) {
        var key = engines[i];
        var engine = this.settings.engines[key];
        if (!engine.extension) {
            engine.extension = key;
        }
        engine = Utils.merge(Utils.clone(Defaults.views.engines.html), engine);
        this.engines.add(engine);
    }
};


internals.Manager.prototype.render = function (template, context, options) {

    if (typeof template === 'string') {
        template = this._get(template, options);
        if (template instanceof Error) {
            return template;
        }
    }

    if (!this.settings.layout) {

        // No layout

        try {
            return template(context);
        }
        catch (err) {
            return Err.internal(err.message, err);
        }
    }

    // With layout

    if (context &&
        context.hasOwnProperty(this.settings.layoutKeyword)) {

        return Err.internal('settings.layoutKeyword conflict', { context: context, keyword: this.settings.layoutKeyword });
    }

    var layout = this._get('layout', options);
    if (layout instanceof Error) {
        return layout;
    }

    var layoutContext = Utils.clone(context);

    try {
        layoutContext[this.settings.layoutKeyword] = template(context);
        return layout(layoutContext);
    }
    catch (err) {
        return Err.internal(err.message, err);
    }
};


internals.Manager.prototype._get = function (filename, options) {

    options = Utils.merge(Utils.clone(this.settings), options);

    if (options.cache && this._cache.hasOwnProperty(filename)) {
        return this._cache[filename];
    }

    // Normalize path

    var isAbsolutePath = (filename.indexOf('/') === 0);
    var isInsecurePath = filename.match(/\.\.\//g) !== null;

    if (!options.allowAbsolutePaths &&
        isAbsolutePath) {

        return Err.internal('Absolute paths are not allowed in views');
    }

    if (!options.allowInsecureAccess &&
        isInsecurePath) {

        return Err.internal('View paths cannot lookup templates outside root path (path includes one or more \'../\')');
    }

    // Resolve Path and extension
    
    var fullPath = filename;
    if (!isAbsolutePath) {
        fullPath = Path.join(options.path, fullPath);
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
        return Err.internal('View file not found: ' + fullPath);
    }
    
    var engine = this.engines.get(fullPath);
    var compiled = engine.compile(source, options.compileOptions);

    if (options.cache) {
        this._cache[filename] = compiled;
    }

    return compiled;
};


internals.Manager.prototype.loadPartials = function () {

    var self = this;
    if (this.settings.partials) {
        this._loadPartials(this.settings.partials.path || this.settings.path, function (files) {

            for (var i = 0, il = files.length; i < il; ++i) {
                var file = files[i];
                var engine = self.engines.get(file);
                if (!engine.hasOwnProperty('registerPartial')) {
                    continue;
                }

                var name = file;
                if (name.indexOf(self.settings.partials.path) >= 0) {
                    name = name.slice(self.settings.partials.path.length + 1, -engine.suffix.length);
                }

                // Remove when handlebars npm module gets updated

                if (engine.VERSION && engine.VERSION.indexOf('1.0.rc') >= 0) {

                    name = name.replace(/\//g, engine.slashReplacement || '-');
                }

                var src = Fs.readFileSync(file).toString(self.settings.encoding);
                engine.registerPartial(name, src);
            }
        });
    }
};


internals.Manager.prototype._loadPartials = function (path, callback) {

    var self = this;
    var suffixes = Object.keys(this.engines.keys());
    
    var walk = function (root, currentPath, files) {

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

            return callback(files);
        }

        var directory = Fs.readdirSync(current);
        for (var i = 0, il = directory.length; i < il; ++i) {
            var currentFile = directory[i];
            var currentFileFullPath = Path.join(root, currentFile);
            if (Fs.statSync(currentFileFullPath).isDirectory()) {
                walk(currentFileFullPath, '/', files);
            }
            else {
                walk(root, currentFile, files);
            }
        }

        return callback(files);
    };

    walk(path, '/', []);
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
