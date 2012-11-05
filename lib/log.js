// Load modules

var NodeUtil = require('util');
var Events = require('events');


// Declare internals

var internals = {};


internals.Logger = function () {

    // Register as event emitter
    Events.EventEmitter.call(this);

    return this;
};

NodeUtil.inherits(internals.Logger, Events.EventEmitter);


internals.Logger.prototype.event = function (tags, data, timestamp) {

    tags = (tags instanceof Array ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp : new Date(timestamp)) : new Date());

    var event = {
        ets: now.getTime(),
        tags: tags,
        data: data
    };

    if (!this.emit('log', event)) {
        // Output to console if no listeners
        this.print(event, true);
    }
};


internals.Logger.prototype.print = function (event, _isBypass, _isTest) {

    if (process.env.NODE_ENV === 'test' &&
        !_isTest) {

        return;                                         // Silence log output during test execution
    }

    var pad = function (value) {

        return (value < 10 ? '0' : '') + value;
    };

    var now = new Date(event.ets);
    var timestring = (now.getYear() - 100).toString() +
                     pad(now.getMonth() + 1) +
                     pad(now.getDate()) +
                     '/' +
                     pad(now.getHours()) +
                     pad(now.getMinutes()) +
                     pad(now.getSeconds()) +
                     '.' +
                     now.getMilliseconds();

    var data = event.data;
    if (typeof event.data !== 'string') {
        try {
            data = JSON.stringify(event.data);
        }
        catch (e) {
            data = 'JSON Error: ' + e.message;
        }
    }

    var output = (_isBypass ? '*' : '') + timestring + ', ' + event.tags[0] + ', ' + data;
    console.log(output);
};


module.exports = new internals.Logger();

