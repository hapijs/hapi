var Fs = require('fs');
var Path = require('path');
var Utils = require('../utils');
var Partials = require('./partials');

// Declare internals

var internals = {};


internals.Views = function () {

    this.options = {};
    this.engine = null;
    
    internals.Views.cache = internals.Views.cache || {}; // Static Cache of Compiled Templates
    
    return this;
};


internals.Views.prototype._defaultOptions = {
    engine: {
        module: "handlebars",
        extension: "html",
        slashReplacement: '_' // Remove when handlebars npm module gets updated
    },
    layout: false,
    layoutKeyword: 'content',
    encoding: 'utf-8',
    cache: {},
    allowAbsolutePaths: null,
    allowInsecureAccess: null,
};


internals.Views.prototype.init = function (options) {

    this.options = Utils.merge(Utils.clone(this._defaultOptions), options || {});
    this.loadEngine();
    this.loadPartials();
    
    return this;
};


internals.Views.prototype.loadEngine = function () {

    this.engine = require(this.options.engine.module || 'handlebars');
    
    return this;
};


internals.Views.prototype.loadPartials = function () {

    if (this.options.partials) {
        // assert this.options.partials.path
        var self = this;
        this._Partials = new Partials();
        this._Partials.find(this.options.partials.path, function (err, files) {

            self.processPartials(err, files);
        });
    }
    
    return this;
};

internals.Views.prototype.processPartials = function (err, files) {

    if (err) {
        throw err;
    }
    
    for(var i in files) {
        var file = files[i];
        var name = this._Partials.getPartialName(this.options, this.engine, file);
        var src = Fs.readFileSync(file).toString(this.options.encoding);
        
        this.engine.registerPartial(name, src);
    }
};


internals.Views.prototype.isAbsPath = function (path) {

    return path.indexOf('/') == 0;
};


internals.Views.prototype.isInsecureAccessAttempt = function (path) {

    return path.match(/\.\.\//g) != null;
};


internals.Views.prototype.appendExtension = function (filename) {

    filename = filename || "";
    return filename + '.' + (this.options.engine.extension || 'html');
};


internals.Views.prototype.getPath = function (path) {

    if (!this.options.allowAbsolutePaths && this.isAbsPath(path)){
        throw 'Absolute paths are not allowed in Views';
    } 
    
    if (!this.options.allowInsecureAccess && this.isInsecureAccessAttempt(path)) {
        throw 'View paths cannot lookup templates outside root path (path includes one or more \'../\')';
    }
    
    if (this.options.allowAbsolutePaths && this.isAbsPath(path)) {
        var fullPath = this.appendExtension(path);
    }
    else {
        var fullPath = Path.join(this.options.path, this.appendExtension(path));
    }
    
    if (!Fs.existsSync(fullPath)) {
        throw 'View path (' + fullPath + ') does not exist';
    }
    
    return fullPath;
};


internals.Views.prototype.open = function (filename) {

    return Fs.readFileSync(this.getPath(filename)).toString(this.options.encoding);
};


internals.Views.prototype.get = function (filename, options) {

    options = Utils.merge(Utils.clone(this.options), options);
    
    if (options.cache && internals.Views.cache.hasOwnProperty(filename)) {
        return internals.Views.cache[filename];
    }
    
    var source = this.open(filename);
    var compiled = this.engine.compile(source);
    
    if (options.cache) {
        internals.Views.cache[filename] = compiled;
    }
    
    return compiled;
};


internals.Views.prototype.render = function (template, context, viewSpecificSettings) {

    if (typeof template == 'string') {
        template = this.get(template, viewSpecificSettings);
    }
    
    if (this.options.layout) {
        var layout = this.get('layout', viewSpecificSettings);
        var layoutContext = Utils.clone(context);
        
        if (context.hasOwnProperty(this.options.layoutKeyword)) {
            throw "Hapi.settings.views.layoutKeyword (" + this.options.layoutKeyword + ") improperly overlaps with existing key in context: " + JSON.stringify(context);
        }
        
        layoutContext[this.options.layoutKeyword] = this.WrapTemplateEval(template, context);
        
        return this.WrapTemplateEval(layout, layoutContext);
    }
    else {
        return this.WrapTemplateEval(template, context);;
    }
};


internals.Views.prototype.WrapTemplateEval = function (template, context) {

    var result = "";
    try {
        result = template(context);
    }
    catch (err) {
        throw err;
    }
    
    return result;
}


exports = module.exports = new internals.Views();
module.exports.Views = internals.Views;
module.exports.Partials = Partials;