// Load modules


// Declare internals

var internals = {};


// Manually Closed response

exports = module.exports = internals.Closed = function () {

    this.variety = 'closed';
    this.varieties = { closed: true };

    return this;
};
