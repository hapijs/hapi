// Load modules

var Hoek = require('hoek');
var Response = require('./response');


// Declare internals

var internals = {};


exports = module.exports = internals.Reply = function () {

    this._methods = {
        view: internals.view
    };
};


internals.Reply.prototype.decorate = function (name, method) {

    Hoek.assert(name, 'Missing reply interface decoration name');
    Hoek.assert(typeof name === 'string', 'Reply interface decoration must be a string');
    Hoek.assert(!this._methods[name], 'Reply interface decoration already defined:', name);
    Hoek.assert(['request', 'response', 'close', 'state', 'unstate', 'redirect', 'continue'].indexOf(name) === -1, 'Cannot override built-in reply interface decoration:', name);

    this._methods[name] = method;
};


internals.Reply.prototype._interface = function (request, next, options) {

    options = options || {};

    var reply = function (response, data) {

        if (!options.data) {
            return reply.response(response !== null && response !== undefined ? response : data);
        }

        if (response !== undefined &&
            response !== null) {

            reply._data = data;                 // Held for later
            return reply.response(response);
        }

        return next(null, data);
    };

    reply._replied = false;
    reply._next = Hoek.once(next);
    reply._viewsManager = (options.env && options.env.views) || request._route._env.views || request.server._env.views;

    reply.request = request;
    reply.response = internals.response;
    reply.close = internals.close;
    reply.state = internals.state;
    reply.unstate = internals.unstate;
    reply.redirect = internals.redirect;

    if (options.continue) {
        reply.continue = internals.continue;
    }

    var methods = Object.keys(this._methods);
    for (var i = 0, il = methods.length; i < il; ++i) {
        var method = methods[i];
        reply[method] = this._methods[method];
    }

    return reply;
};


internals.view = function (template, context, options) {

    Hoek.assert(this._viewsManager, 'Cannot render view without a views manager configured');
    return this.response(this._viewsManager.response(template, context, options, this.request));
};


internals.close = function (options) {

    options = options || {};
    this._next({ closed: true, end: options.end !== false });
};


internals.continue = function () {

    this._next();
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

    var self = this;

    Hoek.assert(!this._replied, 'reply interface called twice');
    this._replied = true;

    var response = Response.wrap(result, this.request);

    if (response.isBoom) {
        this._next(response, this._data);
        return response;
    }

    response._prepare = function () {

        this._prepare = undefined;

        if (this._processors.prepare) {
            return this._processors.prepare(this, function (prepared) {

                return self._next(prepared, self._data);
            });
        }

        return self._next(this, self._data);
    };

    response.hold = internals.hold;

    process.nextTick(function () {

        response.hold = undefined;

        if (!response.send &&
            response._prepare) {

            response._prepare();
        }
    });

    return response;
};


internals.hold = function () {

    this.hold = undefined;
    this.send = internals.send;
    return this;
};


internals.send = function () {

    this.send = undefined;
    this._prepare();
};