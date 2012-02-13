/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var URL = require('url');
var Sugar = require('sugar');
var Express = require('express');
var MAC = require('mac');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Process = require('./process');


// Declare internals

var internals = {

    // Default configuration

    defaultConfig: {

        // Server Configuration

        uri: 'http://localhost:80',

        host: {                                 // Automatically set from 'uri'

            domain: 'localhost',
            scheme: 'http',
            port: '80',
            authority: 'localhost:80'
        },

        // Terms of Service

        tos: {

            min: '19700101'
        },

        // Authentication

        authentication: {

            loadSession: null
        }
    },

    // Servers instances by uri

    serversByUri: {}
}


// Create and configure server instance

exports.create = function (options, paths) {

    // Create server object

    var server = {

        // Private members
        // ----------------------------------------------------------------

        settings: Object.merge(internals.defaultConfig, options || {}),
        express: Express.createServer(),

        // Initialize server
        // ----------------------------------------------------------------

        initialize: function () {

            // Parse URI and set components

            server.settings.uri = server.settings.uri.toLowerCase();
            var uri = URL.parse(server.settings.uri);
            server.settings.host = {

                domain: uri.hostname,
                port: uri.port,
                scheme: uri.protocol,
                authority: uri.host
            };

            // Configure Express

            server.express.configure(function () {

                server.express.use(server.preRoute);                                                        // Pre-Routes Middleware
                server.express.use(server.express.router);                                                  // Load Routes
                server.express.use(server.postRoute);                                                       // Post-Routes Middleware
                server.express.use(Express.errorHandler({ dumpExceptions: true, showStack: false }));       // Err handler
            });

            // Override generic OPTIONS route

            server.express.options(/.+/, function (req, res, next) {

                res.hapi.result = ' ';
                server.postRoute(req, res, next);
            });

            // Load paths

            for (var i = 0, il = paths.length; i < il; ++i) {

                server.public.addRoute(paths[i]);
            }
        },

        // Route pre-processor
        // ----------------------------------------------------------------

        preRoute: function (req, res, next) {

            Log.info('Received', req);

            req.hapi = {};
            res.hapi = {};

            next();
        },

        // Set default response headers and send response
        // ----------------------------------------------------------------

        postRoute: function (req, res, next) {

            if (res.hapi.isReplied !== true) {

                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match');
                res.header('Access-Control-Max-Age', '86400');  // One day

                res.header('Cache-Control', 'must-revalidate');

                if (res.hapi.result) {

                    // Sanitize database fields

                    var rev = null; // res.hapi.result.modified;

                    if (res.hapi.result._id) {

                        res.hapi.result.id = res.hapi.result._id;
                        delete res.hapi.result._id;
                    }

                    if (res.hapi.result instanceof Object) {

                        for (var i in res.hapi.result) {

                            if (res.hapi.result.hasOwnProperty(i)) {

                                if (i[0] === '_') {

                                    delete res.hapi.result[i];
                                }
                            }
                        }
                    }

                    if (req.method === 'GET' && rev) {

                        res.header('ETag', rev);

                        var condition = internals.parseCondition(req.headers['if-none-match']);

                        if (condition[rev] ||
                            condition['*']) {

                            res.send('', 304);
                        }
                        else {

                            res.send(res.hapi.result);
                        }
                    }
                    else if (res.hapi.options.created) {

                        res.send(res.hapi.result, { 'Location': server.settings.uri + res.hapi.options.created }, 201);
                    }
                    else {

                        res.send(res.hapi.result);
                    }

                    Log.info('Replied', req);
                }
                else {

                    var error = res.hapi.error || Err.notFound('No such path or method');

                    if (error.type === 'oauth') {

                        res.send({ error: error.error, error_description: error.text }, error.code);
                    }
                    else {

                        res.send({ error: error.text, message: error.message, code: error.code }, error.code);
                    }

                    if (res.hapi.error) {

                        Log.err(res.hapi.error, req);
                    }
                    else {

                        Log.info(error, req);
                    }
                }

                res.hapi.isReplied = true;
            }
        },

        // Public members

        public: {

            // Start server listener
            // ----------------------------------------------------------------

            start: function () {

                server.express.listen(server.settings.host.port, server.settings.host.domain);
                Log.info(Process.settings.name + ' Server started at ' + server.settings.uri);
            },

            // Add server route
            // ----------------------------------------------------------------

            addRoute: function (config) {

                var handler = function (req, res, next) {

                    // Authentication

                    internals.authenticate(req, res, config, server, function (err) {

                        if (err === null) {

                            // Query parameters

                            internals.validateQuery(req, config.query ? Utils.map(config.query) : null, function (err) {

                                if (err === null) {

                                    // Load payload

                                    internals.processBody(req, config.payload || (config.data ? 'parse' : null), function (err) {

                                        if (err === null) {

                                            // Validate payload schema

                                            internals.validateData(req, config.data || null, function (err) {

                                                if (err === null) {

                                                    // Route handler

                                                    config.handler(req, function (result, options) {

                                                        if (result instanceof Error) {

                                                            res.hapi.error = result;
                                                        }
                                                        else {

                                                            res.hapi.result = result;
                                                        }

                                                        res.hapi.options = options || {};
                                                        next();
                                                    });
                                                }
                                                else {

                                                    res.hapi.error = err;
                                                    next();
                                                }
                                            });
                                        }
                                        else {

                                            res.hapi.error = err;
                                            next();
                                        }
                                    });
                                }
                                else {

                                    res.hapi.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.hapi.error = err;
                            next();
                        }
                    });
                };

                // Add route to Express

                switch (config.method) {

                    case 'GET': server.express.get(config.path, handler); break;
                    case 'POST': server.express.post(config.path, handler); break;
                    case 'PUT': server.express.put(config.path, handler); break;
                    case 'DELETE': server.express.del(config.path, handler); break;
                    default: process.exit(1); break;
                }
            },

            // Access internal Express server object
            // ----------------------------------------------------------------

            getExpress: function () {

                return server.express;
            }
        }
    };

    // Initialize and add to instances list

    server.initialize();
    internals.serversByUri[server.settings.uri] = server;

    // Return public interface

    return server.public;
};


// Return server object

exports.instance = function (uri) {

    if (uri) {

        uri = uri.toLowerCase();

        var server = internals.serversByUri[uri];
        if (server) {

            return server;
        }
        else {

            return null;
        }
    }
    else {

        var uris = Object.keys(internals.serversByUri);
        if (uris.length === 1) {

            return internals.serversByUri[uris[0]];
        }
        else if (uris.length === 0) {

            return null;
        }
        else {

            Log.err('Cannot call Server.instance() without uri in a process with multiple server instances');
            process.exit(1);
        }
    }
};


// Return server object configuration

exports.settings = function (uri) {

    var server = exports.instance(uri);
    if (server) {

        return server.settings;
    }
    else {

        return null;
    }
};


// Token Authentication

internals.authenticate = function (req, res, routeConfig, server, callback) {

    var scope = routeConfig.scope || null;
    var minTos = routeConfig.tos || server.settings.tos.min;
    var userMode = routeConfig.user || 'required';
    var isOptional = (routeConfig.authentication === 'optional');

    if (routeConfig.authentication === 'none') {

        callback(null);
        return;
    }

    var getSession = function (id, callback) {

        if (server.settings.authentication.loadSession) {

            server.settings.authentication.loadSession(id, function (session) {

                callback(session);
            });
        }
        else {

            Log.err('Not configured to recieve authenticated requests');
            callback(null);
        }
    };

    MAC.authenticate(req, getSession, { isHTTPS: server.settings.host.scheme === 'https' }, function (isAuthenticated, session, err) {

        if (isAuthenticated) {

            if (session) {

                req.hapi.session = session;

                if (session.client) {

                    req.hapi.clientId = session.client;

                    // Check scope

                    if (scope === null ||
                        session.scope[scope]) {

                        req.hapi.scope = session.scope;

                        if (userMode === 'required') {

                            if (session.user) {

                                // Check TOS

                                if (minTos === 'none' ||
                                    (session.tos && session.tos >= minTos)) {

                                    req.hapi.userId = session.user;
                                    callback(null);
                                }
                                else {

                                    callback(Err.forbidden('Insufficient TOS accepted'));
                                }
                            }
                            else {

                                callback(Err.forbidden('Client token cannot be used on a user endpoint'));
                            }
                        }
                        else if (userMode === 'none') {

                            if (session.user) {

                                callback(Err.forbidden('User token cannot be used on a client endpoint'));
                            }
                            else {

                                callback(null);
                            }
                        }
                        else if (userMode === 'any') {

                            callback(null);
                        }
                        else {

                            callback(Err.internal('Unknown endpoint user mode'));
                        }
                    }
                    else {

                        callback(Err.forbidden('Insufficient token scope (\'' + scope + '\' expected for client ' + session.client + ')'));
                    }
                }
                else {

                    callback(Err.internal('Missing client identifier in authenticated token'));
                }
            }
            else {

                callback(Err.internal('Missing user object in authenticated token'));
            }
        }
        else {

            // Unauthenticated

            if (isOptional &&
                !req.headers.authorization) {

                callback(null);
            }
            else {

                res.header('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                callback(Err.generic(401, 'Invalid authentication', err));
            }
        }
    });
};


// Validate query

internals.validateQuery = function (req, parameters, callback) {

    if (parameters === null) {

        return callback(null);
    }

    var isInvalid = false;
    for (var i in req.query) {

        if (req.query.hasOwnProperty(i)) {

            if (parameters[i] !== true) {

                isInvalid = true;
                break;
            }
        }
    }

    if (isInvalid) {

        callback(Err.badRequest('Unknown parameter: ' + i));
    }
    else {

        callback(null);
    }
};


// Read and parse body

internals.processBody = function (req, level, callback) {

    // Levels are: 'none', 'raw', 'parse'
    // Default is 'parse' for POST and PUT otherwise 'none'

    level = level || (req.method === 'POST' || req.method === 'PUT' ? 'parse' : 'none');

    if (level === 'none') {

        return callback(null);
    }

    // Check content type (defaults to 'application/json')

    var contentType = req.headers['content-type'];
    if (contentType &&
        contentType.split(';')[0] !== 'application/json') {

        return callback(Err.badRequest('Unsupported content-type'));
    }

    // Read incoming data

    var data = '';
    req.setEncoding('utf8');
    req.addListener('data', function (chunk) {

        data += chunk;
    });

    req.addListener('end', function () {

        req.hapi.rawBody = data;

        if (level === 'parse') {

            if (data) {

                try {

                    req.hapi.payload = JSON.parse(data);
                }
                catch (err) {

                    req.hapi.payload = {};
                    return callback(Err.badRequest('Invalid JSON body'));
                }

                callback(null);
            }
        }
    });
};


// Validate data

internals.validateData = function (req, definition, callback) {

    if (definition === null) {

        return callback(null);
    }

    var isInvalid = false;
    var err = '';

    // Check required variables

    for (var i in definition) {

        if (definition.hasOwnProperty(i)) {

            if (definition[i].required === true) {

                if (req.hapi.payload[i] === undefined) {

                    err = 'missing required parameter';
                    isInvalid = true;
                    break;
                }
            }
        }
    }

    if (isInvalid === false) {

        // Check each incoming variable

        for (var i in req.hapi.payload) {

            if (req.hapi.payload.hasOwnProperty(i)) {

                // Lookup variable definition

                if (definition[i] === undefined) {

                    err = 'unknown parameter';
                    isInvalid = true;
                    break;
                }

                // Check if update allowed

                if (definition[i].set === false) {

                    err = 'forbidden parameter';
                    isInvalid = true;
                    break;
                }

                // Check for array type

                if (definition[i].array === true) {

                    // If variable is an array

                    if (req.hapi.payload[i] instanceof Array) {

                        // Check for empty array

                        if (req.hapi.payload[i].length === 0 &&
                            definition[i].empty !== true) {

                            err = 'empty array not allowed';
                            isInvalid = true;
                            break;
                        }

                        // For each array element, check type

                        for (var a = 0, al = req.hapi.payload[i].length; a < al; ++a) {

                            var message = internals.checkValue(req.hapi.payload[i][a], definition[i], false);
                            if (message) {

                                err = 'invalid array value - ' + message;
                                isInvalid = true;
                                break;
                            }
                        }

                        // Double break

                        if (isInvalid === true) {

                            break;
                        }
                    }
                    else {

                        err = 'array value required';
                        isInvalid = true;
                        break;
                    }
                }
                else {

                    if (definition[i].type !== 'any') {

                        var result = internals.checkValue(req.hapi.payload[i], definition[i], definition[i].empty);
                        if (result) {

                            err = result;
                            isInvalid = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    if (isInvalid) {

        callback(Err.badRequest('\'' + i + '\': ' + err));
    }
    else {

        callback(null);
    }
};


internals.checkValue = function (value, definition, isEmptyAllowed) {

    // Check for empty value

    if (value === null ||
        (typeof value === 'number' && isNaN(value)) ||
        (typeof value === 'string' && value === '')) {

        if (isEmptyAllowed !== true) {

            return 'empty value not allowed';
        }
        else {

            return '';
        }
    }

    // Check types

    var isValid = false;

    switch (definition.type) {

        case 'string': isValid = (typeof value === 'string'); break;
        case 'id': isValid = (typeof value === 'string'); break;
        case 'number': isValid = (typeof value === 'number'); break;
        case 'enum': isValid = (typeof value === 'string' && definition.values && definition.values[value] > 0); break;
        case 'object': isValid = (typeof value === 'object'); break;
        case 'email': isValid = Utils.checkEmail(value); break;
        case 'date':

            if (typeof value !== 'string') {

                return 'value must be a string';
            }

            var dateRegex = /^([12]\d\d\d)-([01]\d)-([0123]\d)$/;
            var date = dateRegex.exec(value);

            if (date === null || date.length !== 4) {

                return 'invalid date string format';
            }

            var year = parseInt(date[1], 10);
            var month = parseInt(date[2], 10);
            var day = parseInt(date[3], 10);

            if (year < 1970 || year > 3000) {

                return 'invalid year: ' + date[1];
            }

            if (month < 1 || month > 12) {

                return 'invalid month: ' + date[2];
            }

            if (day < 1 || day > 31) {

                return 'invalid day: ' + date[3];
            }

            isValid = true;
            break;

        case 'time':

            if (typeof value !== 'string') {

                return 'value must be a string';
            }

            var timeRegex = /^([012]\d):([012345]\d):([012345]\d)$/;
            var time = timeRegex.exec(value);

            if (time === null || time.length !== 4) {

                return 'invalid time string format';
            }

            var hour = parseInt(time[1], 10);
            var minute = parseInt(time[2], 10);
            var second = parseInt(time[3], 10);

            if (hour < 0 || hour > 23) {

                return 'invalid hour';
            }

            if (minute < 0 || minute > 59) {

                return 'invalid minute';
            }

            if (second < 0 || second > 59) {

                return 'invalid second';
            }

            isValid = true;
            break;
    }

    return (isValid ? '' : 'bad value type, ' + definition.type + ' expected');
};


// Parse If-None-Match request header

internals.parseCondition = function (condition) {

    if (condition) {

        result = {};

        var conditionRegex = (condition.indexOf('"') !== -1 ? /(?:^|,)(?:\s*")([^"]+)(?:"\s*)/g : /(?:^|,)(?:\s*)([^\s]+)(?:\s*)/g);
        condition.replace(conditionRegex, function ($0) {

            if ($0) {

                result[$0] = true;
            }
        });

        return result;
    }
    else {

        return {};
    }
};
