/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Os = require('os');
var Express = require('express');
var MAC = require('mac');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Config = require('./config');


// Declare internals

var internals = {};


// Listen to uncaught exceptions

process.on('uncaughtException', function (err) {

    Log.err('Uncaught exception: ' + err.stack);

    if (Config.settings.email.admin) {

        Utils.email(Config.settings.email.admin, 'ERROR: Exception on ' + Config.settings.name + ' server', err.stack, '', function (err) {

            process.exit(1);
        });
    }
});


// Create and configure server instance

exports.create = function (paths, options) {

    // Set configuration

    Config.configure(options);

    // Send startup email

    if (Config.settings.email.admin) {

        Utils.email(Config.settings.email.admin, 'NOTICE: ' + Config.settings.name + ' server started', 'Started on ' + Os.hostname());
    }

    // Create server

    var server = Express.createServer();

    // Configure Server

    server.configure(function () {

        // Pre-Routes Middleware

        server.use(internals.preprocessRequest);

        // Load Routes

        server.use(server.router);

        // Post-Routes Middleware

        server.use(internals.finalizeResponse);

        // Err handler

        server.use(Express.errorHandler({ dumpExceptions: true, showStack: false }));
    });

    // Override generic OPTIONS route

    server.options(/.+/, function (req, res, next) {

        res.api.result = ' ';
        internals.finalizeResponse(req, res, next);
    });

    // Load paths

    for (var i = 0, il = paths.length; i < il; ++i) {

        internals.setRoute(server, paths[i]);
    }

    return server;
};


exports.start = function (server) {

    // Start Server

    server.listen(Config.settings.host.port, Config.settings.host.domain);
    Log.info(Config.settings.name + ' Server started at ' + Config.settings.uri);

    // Change OS User

    if (Config.settings.process.runAs) {

        Log.info(Config.settings.name + ' Server switching users from ' + process.getuid() + ' to ' + Config.settings.process.runAs);
        try {

            process.setuid(Config.settings.process.runAs);
            Log.info(Config.settings.name + ' Server active user: ' + process.getuid());
        }
        catch (err) {

            Log.err('Failed setting uid: ' + err);
            process.exit(1);
        }
    }
};


// Route pre-processor

internals.preprocessRequest = function (req, res, next) {

    Log.info('Received', req);

    req.api = {};
    res.api = {};

    // Parse body

    var parser = null;

    var contentType = req.headers['content-type'];
    if (!contentType ||
        contentType.split(';')[0] === 'application/json') {

        parser = JSON.parse;
    }

    var data = '';
    req.setEncoding('utf8');
    req.addListener('data', function (chunk) {

        data += chunk;
    });

    req.addListener('end', function () {

        req.rawBody = data;
        req.body = {};

        if (data && parser) {

            try {

                req.body = parser(data);
            }
            catch (err) {

                res.api.error = Err.badRequest('Invalid JSON body');
            }
        }
        else if (data) {

            res.api.error = Err.badRequest('Unsupported content-type');
        }

        if (res.api.error) {

            internals.finalizeResponse(req, res, next);
        }
        else {

            next();
        }
    });
};


// Setup route validation

internals.setRoute = function (server, config) {

    var routes = [];

    // Authentication

    if (config.authentication !== 'none') {

        routes.push(internals.authenticate(config.scope || null,
                                           config.tos || Config.settings.tos.min,
                                           config.user || 'required',
                                           config.authentication === 'optional',
                                           Config.settings.authentication.loadSession));
    }

    // Query parameters

    if (config.query) {

        routes.push(internals.validateQuery(config.query));
    }

    // Body structure

    if (config.data) {

        routes.push(internals.validateData(config.data));
    }

    // Set route

    switch (config.method) {

        case 'GET': server.get(config.path, routes, config.handler); break;
        case 'POST': server.post(config.path, routes, config.handler); break;
        case 'PUT': server.put(config.path, routes, config.handler); break;
        case 'DELETE': server.del(config.path, routes, config.handler); break;
        default: process.exit(1); break;
    }
};


// Token Authentication

internals.authenticate = function (scope, minTos, userMode, isOptional, loadSession) {

    var getSession = function (id, cookie, callback) {

        if (loadSession) {

            loadSession(id, function (session) {

                callback(session);
            });
        }
        else {

            callback(null);
            Log.err('Not configured to recieve authenticated requests');
        }
    };

    var options = {

        isHTTPS: (Config.settings.host.scheme === 'https'),
        bodyHashMode: 'require'
    };

    return function (req, res, next) {

        MAC.authenticate(req, res, getSession, options, function (isAuthenticated, session, err) {

            if (isAuthenticated) {

                if (session) {

                    req.api.session = session;

                    if (session.client) {

                        req.api.clientId = session.client;

                        // Check scope

                        if (scope === null ||
                            session.scope[scope]) {

                            req.api.scope = session.scope;

                            if (userMode === 'required') {

                                if (session.user) {

                                    // Check TOS

                                    if (minTos === 'none' ||
                                        (session.tos && session.tos >= minTos)) {

                                        req.api.userId = session.user;
                                        next();
                                    }
                                    else {

                                        res.api.error = Err.forbidden('Insufficient TOS accepted');
                                        internals.finalizeResponse(req, res, next);
                                    }
                                }
                                else {

                                    res.api.error = Err.forbidden('Client token cannot be used on a user endpoint');
                                    internals.finalizeResponse(req, res, next);
                                }
                            }
                            else if (userMode === 'none') {

                                if (session.user) {

                                    res.api.error = Err.forbidden('User token cannot be used on a client endpoint');
                                    internals.finalizeResponse(req, res, next);
                                }
                                else {

                                    next();
                                }
                            }
                            else if (userMode === 'any') {

                                next();
                            }
                            else {

                                res.api.error = Err.internal('Unknown endpoint user mode');
                                internals.finalizeResponse(req, res, next);
                            }
                        }
                        else {

                            res.api.error = Err.forbidden('Insufficient token scope (\'' + scope + '\' expected for client ' + session.client + ')');
                            internals.finalizeResponse(req, res, next);
                        }
                    }
                    else {

                        res.api.error = Err.internal('Missing client identifier in authenticated token');
                        internals.finalizeResponse(req, res, next);
                    }
                }
                else {

                    res.api.error = Err.internal('Missing user object in authenticated token');
                    internals.finalizeResponse(req, res, next);
                }
            }
            else {

                // Unauthenticated

                if (isOptional &&
                    !req.headers.authorization) {

                    next();
                }
                else {

                    res.api.error = Err.generic(401, 'Invalid authentication', err);
                    res.header('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                    internals.finalizeResponse(req, res, next);
                }
            }
        });
    };
};


// Validate query

internals.validateQuery = function (definition) {

    var parameters = {};
    for (var i in definition) {

        if (definition.hasOwnProperty(i)) {

            parameters[definition[i]] = true;
        }
    }

    return function (req, res, next) {

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

            res.api.error = Err.badRequest('Unknown parameter: ' + i);
            internals.finalizeResponse(req, res, next);
        }
        else {

            next();
        }
    };
};


// Validate data

internals.validateData = function (definition) {

    return function (req, res, next) {

        var isInvalid = false;
        var err = '';

        // Check required variables

        for (var i in definition) {

            if (definition.hasOwnProperty(i)) {

                if (definition[i].required === true) {

                    if (req.body[i] === undefined) {

                        err = 'missing required parameter';
                        isInvalid = true;
                        break;
                    }
                }
            }
        }

        if (isInvalid === false) {

            // Check each incoming variable

            for (var i in req.body) {

                if (req.body.hasOwnProperty(i)) {

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

                        if (req.body[i] instanceof Array) {

                            // Check for empty array

                            if (req.body[i].length === 0 &&
                                definition[i].empty !== true) {

                                err = 'empty array not allowed';
                                isInvalid = true;
                                break;
                            }

                            // For each array element, check type

                            for (var a = 0, al = req.body[i].length; a < al; ++a) {

                                var message = internals.checkValue(req.body[i][a], definition[i], false);
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

                            var result = internals.checkValue(req.body[i], definition[i], definition[i].empty);
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

            res.api.error = Err.badRequest('\'' + i + '\': ' + err);
            internals.finalizeResponse(req, res, next);
        }
        else {

            next();
        }
    };
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


// Set default response headers and send response

internals.finalizeResponse = function (req, res, next) {

    if (res.api.isReplied !== true) {

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match');
        res.header('Access-Control-Max-Age', '86400');  // One day

        res.header('Cache-Control', 'must-revalidate');

        if (res.api.result) {

            // Sanitize database fields

            var rev = null; // res.api.result.modified;

            if (res.api.result._id) {

                res.api.result.id = res.api.result._id;
                delete res.api.result._id;
            }

            if (res.api.result instanceof Object) {

                for (var i in res.api.result) {

                    if (res.api.result.hasOwnProperty(i)) {

                        if (i[0] === '_') {

                            delete res.api.result[i];
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

                    res.send(res.api.result);
                }
            }
            else if (res.api.created) {

                res.send(res.api.result, { 'Location': Config.settings.uri + res.api.created }, 201);
            }
            else {

                res.send(res.api.result);
            }

            Log.info('Replied', req);
        }
        else {

            var error = res.api.error || Err.notFound('No such path or method');

            if (error.type === 'oauth') {

                res.send({ error: error.error, error_description: error.text }, error.code);
            }
            else {

                res.send({ error: error.text, message: error.message, code: error.code }, error.code);
            }

            if (res.api.error) {

                Log.err(res.api.error, req);
            }
            else {

                Log.info(error, req);
            }
        }

        res.api.isReplied = true;
    }
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
