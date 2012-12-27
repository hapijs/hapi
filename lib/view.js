var Fs = require('fs');
var Path = require('path');
var Utils = require('./utils');

// Declare internals

var internals = {};


exports = module.exports = internals.View = function (options) {

    this.options = Utils.merge(Utils.clone(this._defaultOptions), options);
    
    this.engine = require(this.options.engine.name || 'handlebars');
    
    internals.View.cache = internals.View.cache || {}; // Static Cache of Compiled Templates
    
    return this;
};


internals.View.prototype._defaultOptions = {
    engine: {
        name: "handlebars",
        extension: "html"
    },
    layout: false,
    encoding: 'utf-8',
    cache: {}
};


internals.View.prototype.isAbsPath = function (path) {

    return path.indexOf('/') == 0;
};


internals.View.prototype.isInsecureAccessAttempt = function (path) {

    return path.match(/\.\.\//g) != null;
};


internals.View.prototype.getExtension = function (filename) {

    filename = filename || "";
    return filename + '.' + this.options.engine.extension || 'html';
};


internals.View.prototype.getPath = function (path) {

    if (this.isAbsPath(path)){
        throw 'Absolute paths are not allowed in Views';
    } 
    
    if (this.isInsecureAccessAttempt(path)) {
        throw 'View paths cannot lookup templates outside root path (path includes one or more \'../\')'
    }
    
    var fullPath = Path.join(this.options.path, this.getExtension(path));
    
    if (!Fs.existsSync(fullPath)) {
        throw 'View path (' + fullPath + ') does not exist';
    }
    else {
        return fullPath;
    }
}

internals.View.prototype.open = function (filename) {

    return Fs.readFileSync(this.getPath(filename)).toString(this.options.encoding);
};


internals.View.prototype.get = function (filename, options) {

    options = Utils.merge(Utils.clone(this.options), options);
    
    if (options.cache && internals.View.cache.hasOwnProperty(filename)) {
        return internals.View.cache[filename];
    }
    
    var source = this.open(filename);
    try {
        var compiled = this.engine.compile(source);
    }
    catch (e) {
        // TODO: nicer msg
        throw e;
    }
    
    if (options.cache) {
        internals.View.cache[filename] = compiled;
    }
    
    return compiled;
}

internals.View.prototype.render = function (template, context, options) {

    if (typeof template == 'string') {
        template = this.get(template, options);
    }
    
    return template(context);
}
