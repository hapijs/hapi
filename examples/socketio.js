// The following initializes a socket.io server.
// The socket.io client JavaScript is located at http://localhost:8080/socket.io/socket.io.js
// To create a new socket.io handshake make a POST request to http://localhost:8080/socket.io/1
// use the resulting session ID for subsequent requests (see https://github.com/LearnBoost/socket.io-spec)
// For example, in the chrome debug console you can create a new WebSocket with the following URI
// 'ws://localhost:8080/socket.io/1/websocket/Ww4ULq6wOTUZYD62v3yu'
// where Ww4ULq6wOTUZYD62v3yu is the session ID

// Load modules

var SocketIO = require('socket.io');
var Hapi = require('../');


// Declare internals

var internals = {};


internals.startServer = function () {

    internals.server = new Hapi.Server(8080);
    internals.server.route({ method: 'GET', path: '/', handler: internals.helloHandler });

    internals.server.start(internals.startSocketIO);
};


internals.startSocketIO = function () {

    var io = SocketIO.listen(internals.server.listener);
};


internals.helloHandler = function () {

    this.reply('Hello');
};


internals.startServer();