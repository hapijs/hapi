// Load modules

var Fs = require('fs');
var Path = require('path');
var Defaults = require('./defaults');
var Utils = require('./utils');
var Err = require('./error');
// Additional engine modules required in constructor


// Declare internals

var internals = {};


exports = module.exports = internals.Manager = function (options) {

    var self = this;

    this.settings = Utils.applyToDefaults(Defaults.views, options);
    this.settings.engine.suffix = '.' + this.settings.engine.extension;

    Utils.assert(!this.settings.partials || this.settings.partials.path, 'Missing partials path');

    this.loadEngines(this.settings.engine);
    this._cache = {};                                                   // Compiled templates cache

    // Load partials

    if (this.settings.partials) {
        this._loadPartials(this.settings.partials.path || this.settings.path, function (files) {

            for (var i = 0, il = files.length; i < il; ++i) {
                var file = files[i];

                var name = file;
                if (name.indexOf(self.settings.partials.path) >= 0) {
                    name = name.slice(self.settings.partials.path.length + 1, -self.settings.engine.suffix.length);
                }

                // Remove when handlebars npm module gets updated
                if (self.settings.engine.module &&
                    self.settings.engine.module === 'handlebars' &&
                    self.engine.VERSION === '1.0.rc.1') {

                    name = name.replace(/\//g, self.settings.engine.slashReplacement || '-');
                }

                var src = Fs.readFileSync(file).toString(self.settings.encoding);
                self.engine.registerPartial(name, src);
            }
        });
    }

    return this;
};


internals.Manager.prototype.loadEngines = function () {

    Utils.assert(this.settings.engine, 'Missing engine configuration');
    Utils.assert(typeof this.settings.engine == "object", 'Engine configuration is of wrong type (must be Array or Object, is' + typeof this.settings.engine + ')');
    
    var loadEngine = function (options) {

        return require(options.module);
    };
    
    var settings = this.settings.engine;
    if (settings instanceof Array) {
        for (var i = 0, il = settings.length; i < il; ++i) {
            var key = settings[i].extension;
            this.engine = this.engines[key] = loadEngine(settings[i]);
        }
    }
    else {
        this.engine = loadEngine(settings);
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
    
    var files = Fs.readdir(Path.basename(fullPath));
    
    // if (!Fs.existsSync(fullPath)) {
    //     fullPath = fullPath + options.engine.suffix;
    // }

    // if (!Fs.existsSync(fullPath)) {
    //     return Err.internal('View file not found: ' + fullPath);
    // }

    // Read file

    var source = Fs.readFileSync(fullPath).toString(this.settings.encoding);
    var compiled = this.engine.compile(source, options.compileOptions);

    if (options.cache) {
        this._cache[filename] = compiled;
    }

    return compiled;
};


internals.Manager.prototype._loadPartials = function (path, callback) {

    var self = this;

    var walk = function (root, currentPath, files) {

        var current = Path.join(root, currentPath);
        if (!Fs.statSync(current).isDirectory()) {
            if (current.slice(-self.settings.engine.suffix.length) === self.settings.engine.suffix) {
                files.push(current);
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
