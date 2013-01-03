// var Partials = require('../../lib/views/partials');

// var partialsPath = __dirname + '/views/partials';


// console.log('partialsPath', partialsPath);


// var p = new Partials();

// p.find(partialsPath, function(err, files){
//   console.log(files);
// })

var fs = require('fs');
var Handlebars = require('handlebars');

// var src = fs.readFileSync('/Users/vnguyen/Documents/Projects/hapi/examples/views/views/partials/nav/nav.html').toString();
var src = "fake";
// var post = Handlebars.compile(src);

Handlebars.registerPartial('nav-nav', src);

var html = "should say 'fake': {{> nav-nav}}"

var x = Handlebars.compile(html);
console.log(x({}));