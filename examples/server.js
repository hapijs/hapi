var Hapi = require('../lib');


var routes = [
    { method: 'GET', path: '/products', config: { handler: getProducts, validate: { query: { name: Hapi.types.String() } } } },
    { method: 'GET', path: '/products/{id}', config: { handler: getProduct } },
    { method: 'POST', path: '/products', config: { handler: addProduct, payload: 'parse', validate: { payload: { name: Hapi.types.String().required().min(3) } } } }
];

var server = new Hapi.Server(8080);
server.addRoutes(routes);

server.start(function () {

    console.log('Server started at: ' + server.info.uri);
});

var products = [{
    id: 1,
    name: 'Guitar'
},
    {
        id: 2,
        name: 'Banjo'
    }
];

function getProducts(request) {

    if (request.query.name) {
        request.reply(findProducts(request.query.name));
    }
    else {
        request.reply(products);
    }
}

function findProducts(name) {

    return products.filter(function(product) {
        return product.name.toLowerCase() === name.toLowerCase();
    });
}

function getProduct(request) {

    var product = products.filter(function(p) {
        return p.id === parseInt(request.params.id);
    }).pop();

    request.reply(product);
}

function addProduct(request) {

    var product = {
        id: products[products.length - 1].id + 1,
        name: request.payload.name
    };

    products.push(product);

    request.reply(product).code(201).header('Location', '/products/' + product.id);
}
