var Fs = require('fs');
var Path = require('path');

var Partials = function () {
  
};


Partials.prototype.find = function (path, selector, callback) {

    if (!callback) {
        callback = selector;
        selector = this.defaultSelector;
    }
    
    this.walk(path, '/', [], selector, callback);
};


Partials.prototype.walk = function (root, currentPath, files, selector, callback) {

    var current = Path.join(root, currentPath);
    var self = this;
    
    if (!Fs.statSync(current).isDirectory()) {
        if (selector(current)) {
            files.push(current);
        }
        
        return callback(null, files);
    } else {
        var currentFiles = Fs.readdirSync(current);
        for(var i in currentFiles) {
            var currentFile = currentFiles[i];
            var currentFileFullPath = Path.join(root, currentFile);
            if (Fs.statSync(currentFileFullPath).isDirectory()) {
                var newRoot = currentFileFullPath;
                var currFile = '/';
            }
            else {
                var newRoot = root;
                var currFile = currentFile;
            }
            
            self.walk(newRoot, currFile, files, selector, function(){});
        }
    }
    
    callback(null, files);
};


Partials.prototype.getPartialName = function (options, engine, path) {

    if (path.indexOf(options.partials.path) >= 0) {
        path = path.slice(options.partials.path.length + 1, this.extLength(options));
    }
    
    // Remove when handlebars npm module gets updated
    if (options.engine.module && options.engine.module == "handlebars") {
        if (engine.VERSION == '1.0.rc.1') {
            path = path.replace(/\//g, options.engine.slashReplacement || '-');
        }
    }
    
    return path;
};


// extLength returns value for slicing purposes

Partials.prototype.extLength = function (options) {

    return (-(options.engine.extension || "html").length) - 1
}


Partials.prototype.defaultSelector = function (filename) {

    return filename.slice(-5) == ".html";
}

module.exports = Partials;