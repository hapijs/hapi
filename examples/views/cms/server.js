// Load modules

var Path = require('path');
var Hapi = require('../../../');
var Pages = require('./pages');


// Declare internals

var internals = {};


var view = function (viewName) {

    return function (request) {

        request.reply.view(viewName, { title: viewName });
    };
};


var getPages = function (request) {

    request.reply.view('index', { pages: Object.keys(Pages.getAll()), title: 'All pages' });
};


var getPage = function (request) {

    request.reply.view('page', { page: Pages.getPage(request.params.page), title: request.params.page });
};


var createPage = function (request) {

    Pages.savePage(request.payload.name, request.payload.contents);
    request.reply.view('page', { page: Pages.getPage(request.payload.name), title: 'Create page' });
};


var showEditForm = function (request) {

    request.reply.view('edit', { page: Pages.getPage(request.params.page), title: 'Edit: ' + request.params.page });
};


var updatePage = function (request) {

    Pages.savePage(request.params.page, request.payload.contents);
    request.reply.view('page', { page: Pages.getPage(request.params.page), title: request.params.page });
};

internals.main = function () {

    var options = {
        views: {
            engines: { html: 'handlebars' },
            path: Path.join(__dirname, 'views'),
            layout: true,
            partialsPath: Path.join(__dirname, 'views', 'partials')
        },
        state: {
            cookies: {
                failAction: 'ignore'
            }
        }
    };

    var server = new Hapi.Server(8000, options);
    server.route({ method: 'GET', path: '/', handler: getPages });
    server.route({ method: 'GET', path: '/pages/{page}', handler: getPage });
    server.route({ method: 'GET', path: '/create', handler: view('create') });
    server.route({ method: 'POST', path: '/create', handler: createPage });
    server.route({ method: 'GET', path: '/pages/{page}/edit', handler: showEditForm });
    server.route({ method: 'POST', path: '/pages/{page}/edit', handler: updatePage });
    server.start();
};


internals.main();

