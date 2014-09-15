// Load modules

var Fs = require('fs');
var Hapi = require('hapi');


// Declare internals

var internals = {};


internals.write = function (request, reply) {

    if (request.payload.user) {
        console.log(request.payload.user + ' posted!');
    }

    if (request.payload.file) {
        var file = request.payload.file;
        var out = Fs.createWriteStream(file.hapi.filename);
        file.pipe(out);
        file.on('end', function (err) { 

            reply('received ' + file.hapi.filename);
        });
    } 
    else {
        reply('no file received');
    }
};


internals.main = function () {

    var server = new Hapi.Server(8000);

    server.route({
        method: 'POST',
        path: '/submit',
        config: {
            handler: internals.write,
            payload: {
                output: 'stream',
                parse: true,
                allow: 'multipart/form-data'
            }
        }
    });
    
    server.start();
};

internals.main();
