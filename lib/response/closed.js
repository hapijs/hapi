// Load modules


// Declare internals

var internals = {};


// Base response

exports = module.exports = internals.Closed = function () {

    this.variety = 'closed';
    this.varieties = { closed: true };

    return this;
};
