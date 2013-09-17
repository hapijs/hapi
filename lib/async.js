// Load modules

var Async = require('async');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = Async;


Async.forEachSeriesContext = function (set, context, each, callback) {

    if (!set.length) {
        return Utils.nextTick(callback)();
    }

    var cycle = new internals.Cycle(set, context, Utils.nextTick(each), callback);
    cycle.run();
};


internals.Cycle = function (set, context, each, callback) {

    var self = this;

    this.set = set;
    this.context = context;
    this.each = each;
    this.callback = callback;
    this.pos = 0;

    this.next = function (err) {

        if (err) {
            return self.callback(err, self.context);
        }

        ++self.pos;

        return self.run();
    };
};


internals.Cycle.prototype.run = function () {

    if (this.pos === this.set.length) {
        return this.callback(null, this.context);
    }

    this.each(this.set[this.pos], this.context, this.next);
};
