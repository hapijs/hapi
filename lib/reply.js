'use strict';

// Load modules

const Hoek = require('hoek');
const Response = require('./response');


// Declare internals

const internals = {};


exports = module.exports = internals.Reply = function () {

    this._decorations = null;
};


internals.Reply.prototype.decorate = function (property, method) {

    Hoek.assert(!this._decorations || !this._decorations[property], 'Reply interface decoration already defined:', property);
    Hoek.assert(['request', 'response', 'close', 'state', 'unstate', 'redirect', 'continue'].indexOf(property) === -1, 'Cannot override built-in reply interface decoration:', property);

    this._decorations = this._decorations || {};
    this._decorations[property] = method;
};


/*
    const handler = function (request, reply) {

        reply(error, result, ignore);   -> error || result (continue)
        reply(...).takeover();          -> ... (continue)

        reply.continue(ignore);         -> null (continue)
    };

    const ext = function (request, reply) {

        reply(error, result, ignore);   -> error || result (respond)
        reply(...).takeover();          -> ... (respond)

        reply.continue(ignore);         -> (continue)
    };

    const pre = function (request, reply) {

        reply(error);                   -> error (respond)  // failAction override
        reply(null, result, ignore);    -> result (continue)
        reply(...).takeover();          -> ... (respond)

        reply.continue(ignore);         -> null (continue)
    };

    const auth = function (request, reply) {

        reply(error, result, data);     -> error || result (respond) + data
        reply(...).takeover();          -> ... (respond) + data

        reply.continue(data);           -> (continue) + data
    };
*/

internals.Reply.prototype.interface = function (request, realm, next) {       // next(err || response, data);

    const reply = (err, response, data) => {

        reply._data = data;                 // Held for later
        return reply.response(err !== null && err !== undefined ? err : response);
    };

    reply._replied = false;
    reply._next = Hoek.once(next);

    reply.realm = realm;
    reply.request = request;

    reply.response = internals.response;
    reply.close = internals.close;
    reply.state = internals.state;
    reply.unstate = internals.unstate;
    reply.redirect = internals.redirect;
    reply.continue = internals.continue;

    if (this._decorations) {
        const methods = Object.keys(this._decorations);
        for (let i = 0; i < methods.length; ++i) {
            const method = methods[i];
            reply[method] = this._decorations[method];
        }
    }

    return reply;
};


internals.close = function (options) {

    options = options || {};
    this._next({ closed: true, end: options.end !== false });
};


internals.continue = function (data) {

    this._next(null, data);
    this._next = null;
};


internals.state = function (name, value, options) {

    this.request._setState(name, value, options);
};


internals.unstate = function (name) {

    this.request._clearState(name);
};


internals.redirect = function (location) {

    return this.response('').redirect(location);
};


internals.response = function (result) {

    Hoek.assert(!this._replied, 'reply interface called twice');
    this._replied = true;

    const response = Response.wrap(result, this.request);
    if (response.isBoom) {
        this._next(response, this._data);
        this._next = null;
        return response;
    }

    response.hold = internals.hold(this);

    process.nextTick(() => {

        response.hold = undefined;

        if (!response.send &&
            this._next) {

            response._prepare(this._data, this._next);
            this._next = null;
        }
    });

    return response;
};


internals.hold = function (reply) {

    return function () {

        this.hold = undefined;
        this.send = () => {

            this.send = undefined;
            this._prepare(reply._data, reply._next);
            this._next = null;
        };

        return this;
    };
};
