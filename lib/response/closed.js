// Load modules


// Declare internals

var internals = {};


// Manually Closed response

exports = module.exports = internals.Closed = function () {

    this.isHapiResponse = true;
    this.variety = 'closed';
    this.varieties = { closed: true };
};
