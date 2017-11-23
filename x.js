const Hapi = require('./');
const server = Hapi.server({ port: 8080, routes: {cors: {origin: ['http://*.domain.com']} }});


server.route({ method: 'GET', path: '/test', handler: () => 'Hello test!', options: {tags: ['api']} });
server.route({
  path: '/foobar/{test?}',
  method: 'GET',
  options: {
    tags: ['api'],
    description: 'My route description',
    notes: 'My route notes',
    handler: (request, h) => {
      return 'Hello foobar!';
    }
  }
});

async function startup(){
  await server.start();
}

try{
  startup();
}
catch(err){
  console.log(err);
}

