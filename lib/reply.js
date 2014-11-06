// Load modules

var H2o2 = require('h2o2');
var Hoek = require('hoek');
var Inert = require('inert');
var Response = require('./response');


// Declare internals

var internals = {};


exports = module.exports = internals.Reply = function () {

    this._methods = {
        view: internals.view,
        file: internals.file,
        proxy: internals.proxy
    };
};


internals.Reply.prototype.interface = function (request, finalize, base) {

    var root = function (err, result) {

        return reply._wrap((err !== null && err !== undefined ? err : result));
    };

    var reply = base || root;
    if (base) {
        base._root = root;
    }

    reply._finalize = Hoek.once(finalize);
    reply._viewsManager = (base && base.env && base.env.views) || request._route._env.views || request.server._env.views;
    reply._wrap = internals.wrap;

    reply.request = request;
    reply.close = internals.close;
    reply.state = internals.state;
    reply.unstate = internals.unstate;
    reply.redirect = internals.redirect;

    var methods = Object.keys(this._methods);
    for (var i = 0, il = methods.length; i < il; ++i) {
        var method = methods[i];
        reply[method] = this._methods[method];
    }

    return reply;
};


internals.view = function (template, context, options) {

    Hoek.assert(this._viewsManager, 'Cannot render view without a views manager configured');
    return this._wrap(this._viewsManager.response(template, context, options, this.request, Response.Message));
};


internals.file = function (path, options) {

    return this._wrap(Inert.file.response(path, options, this.request));
};


internals.proxy = function (options) {

    var handler = H2o2.handler(this.request._route, options);
    handler.call(null, this.request, this);                            // Internal handler not using bind
};


internals.close = function (options) {

    options = options || {};
    this._finalize({ closed: true, end: options.end !== false });
};


internals.state = function (name, value, options) {

    this.request._setState(name, value, options);
};


internals.unstate = function (name) {

    this.request._clearState(name);
};


internals.redirect = function (location) {

    return this._wrap('').redirect(location);
};


internals.wrap = function (result) {

    var self = this;

    var response = Response.wrap(result, this.request);

    if (response.isBoom) {
        return this._finalize(response);
    }

    var prepare = function () {

        if (response._processors.prepare) {
            return response._processors.prepare(response, self._finalize);
        }

        return self._finalize(response);
    };

    response.hold = function () {

        response.hold = undefined;

        response.send = function () {

            response.send = undefined;
            prepare();
        };

        return response;
    };

    process.nextTick(function () {

        response.hold = undefined;

        if (!response.send) {
            prepare();
        }
    });

    return response;
};
