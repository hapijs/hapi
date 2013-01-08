// Load modules

var Fs = require('fs');
var Path = require('path');
var Defaults = require('./defaults');
var Utils = require('./utils');
// Additional engine modules required in constructor


// Declare internals

var internals = {};


exports = module.exports = internals.Manager = function (options) {

    var self = this;

    this.settings = Utils.applyToDefaults(Defaults.views, options);
    this.settings.engine.suffix = '.' + this.settings.engine.extension;

    Utils.assert(!this.settings.partials || this.settings.partials.path, 'Missing partials path');

    this.engine = require(this.settings.engine.module);                 // require()
    this._cache = {};                                                   // Compiled templates cache

    // Load partials

    if (this.settings.partials) {
        this._loadPartials(this.settings.partials.path, function (files) {

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


internals.Manager.prototype.render = function (template, context, options) {

    if (typeof template === 'string') {
        template = this._get(template, options);
    }

    if (this.settings.layout) {
        Utils.assert(!context.hasOwnProperty(this.settings.layoutKeyword), 'settings.layoutKeyword[' + this.settings.layoutKeyword + '] conflicts with existing key in context: ' + JSON.stringify(context));

        var layout = this._get('layout', options);
        var layoutContext = Utils.clone(context);
        layoutContext[this.settings.layoutKeyword] = this._applyTemplate(template, context);
        context = layoutContext;
    }

    return this._applyTemplate(template, context);
};


internals.Manager.prototype._get = function (filename, options) {

    options = Utils.merge(Utils.clone(this.settings), options);

    if (options.cache && this._cache.hasOwnProperty(filename)) {
        return this._cache[filename];
    }

    // Normalize path

    var isAbsolutePath = (filename.indexOf('/') === 0);
    var isInsecurePath = filename.match(/\.\.\//g) !== null;

    Utils.assert(this.settings.allowAbsolutePaths || !isAbsolutePath, 'Absolute paths are not allowed in views');
    Utils.assert(this.settings.allowInsecureAccess || !isInsecurePath, 'View paths cannot lookup templates outside root path (path includes one or more \'../\')');

    var fullPath = filename + this.settings.engine.suffix;
    if (!isAbsolutePath) {
        fullPath = Path.join(this.settings.path, fullPath);
    }

    Utils.assert(Fs.existsSync(fullPath), 'View file not found: ' + fullPath);

    // Read file

    var source = Fs.readFileSync(fullPath).toString(this.settings.encoding);
    var compiled = this.engine.compile(source);

    if (options.cache) {
        this._cache[filename] = compiled;
    }

    return compiled;
};


internals.Manager.prototype._applyTemplate = function (template, context) {

    var result = '';
    try {
        result = template(context);
    }
    catch (err) {
        throw err;
    }

    return result;
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


