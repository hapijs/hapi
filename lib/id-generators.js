// ID Generators

var OS = require('os');

var COUNTER_START = 10000;
var COUNTER_END = 99999;
var HOSTNAME = OS.hostname();

var counter = COUNTER_START;

exports = module.exports = {

    'epochms-pid-random': function (now) {
        return now + '-' + process.pid + '-' +
            Math.floor(Math.random() * 0x10000);
    },

    'epochms-hostname-pid-counter': function (now) {

        return now + '-' + HOSTNAME + '-' + process.pid + '-' +
            exports._incrementCounter();

    },

    // exposed for testing roll over
    _incrementCounter: function _incrementCounter() {
        if (counter === COUNTER_END) { // roll back to start
            counter = COUNTER_START;
            return counter;
        }
        counter += 1;
        return counter;
    }
};
