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

    Utils.assert(!this.settings.partials || this.settings.partials.path, 'Missing partials path');

    this._engines = {};                                                 // Multiple engine support (distinguished by extension)
    this._cache = {};                                                   // Compiled templates cache

    this.loadEngines();

    // Load partials

    if (this.settings.partials) {
        this._loadPartials(this.settings.partials.path || this.settings.path, function (files) {

            for (var i = 0, il = files.length; i < il; ++i) {
                var file = files[i];
                var engine = self.getEngine(file);
                
                if (!engine.hasOwnProperty('registerPartial')) {
                    continue;
                }

                var name = file;
                if (name.indexOf(self.settings.partials.path) >= 0) {
                    name = name.slice(self.settings.partials.path.length + 1, -engine.suffix.length);
                }

                // Remove when handlebars npm module gets updated
                if (engine.VERSION && engine.VERSION === '1.0.rc.1') {

                    name = name.replace(/\//g, self.settings.engines[Defaults.views.engine].slashReplacement || '-');
                }

                var src = Fs.readFileSync(file).toString(self.settings.encoding);
                engine.registerPartial(name, src);
            }
        });
    }

    return this;
};


internals.Manager.prototype.initEngine = function (ext, options) {

    this._engines[ext] = this._engines[ext] || {}
    this._engines[ext] = require(options.module);
    this._engines[ext].suffix = '.' + ext;
};


internals.Manager.prototype.getEngine = function (fullPath) {

    var ext = Path.extname(fullPath).slice(1);
    
    if (!this._engines.hasOwnProperty(ext)) {
        return Err.internal('View Engine not found for extension (' + ext + ')');
    }
    
    return this._engines[ext];
}


internals.Manager.prototype.loadEngines = function () {

    if (this.settings.engine) {
        this.settings.engines = this.settings.engines || {}
        
        if (!this.settings.engines.hasOwnProperty(Defaults.views.engine.extension)) {
            this.settings.engine.suffix = '.' + this.settings.engine.extension;
            this.settings.engines[this.settings.engine.extension || Defaults.views.engine.extension] = this.settings.engine;
        }
        
        delete this.settings.engine;
    }
    
    var engines = Object.keys(this.settings.engines);
    for(var i = 0, il = engines.length; i < il; ++i) {
        var key = engines[i];
        this.initEngine(key, this.settings.engines[key]);
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
    
    var engine = this.getEngine(fullPath);
    var compiled = engine.compile(source, options.compileOptions);

    if (options.cache) {
        this._cache[filename] = compiled;
    }

    return compiled;
};


internals.Manager.prototype._loadPartials = function (path, callback) {

    var self = this;
    var suffixes = Object.keys(this._engines);
    
    var walk = function (root, currentPath, files) {

        var current = Path.join(root, currentPath);
        if (!Fs.statSync(current).isDirectory()) {
            try {
                var engine = self.getEngine(current);
                if (current.slice(-engine.suffix.length) === engine.suffix) {
                    files.push(current);
                }
            }
            catch (e) {
                // console.log(e)
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
