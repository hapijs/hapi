var Hapi = require('hapi');
var Stream = require('stream');


var server = new Hapi.Server(8000);

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {

        reply('<script>\n' +
        '  var source = new EventSource("/events");\n' +
        '  source.onmessage = function(e) { document.getElementById("data").innerHTML = e.data; };\n' +
        '  source.onerror = function(e) { document.getElementById("status").innerHTML = "Error"; };\n' +
        '  source.onopen = function(e) { document.getElementById("status").innerHTML = "Open"; };\n' +
        '  var disconnect = function () { source.close(); };\n' +
        '</script>\n' +
        'Status: <span id="status"></span><br/>Data: <span id="data"></span><br/><button onclick="disconnect()">Close</button>');
    }
});

server.route({
    method: 'GET',
    path: '/events',
    handler: function(request, reply) {

        var channel = new Stream.PassThrough();

        var data = 0;
        var interval = setInterval(function() {

            channel.write('data: ' + data++ + '\n\n')
            console.log('Sending data: ' + data);
        }, 1000);

        var response = reply(channel);
        response.code(200)
                .type('text/event-stream')
                .header('Connection', 'keep-alive')
                .header('Cache-Control', 'no-cache')
                .header('Content-Encoding', 'identity');

        request.once('disconnect', function () {

            clearInterval(interval);
            console.log('Listener closed');
        });
    }
});

server.start();
