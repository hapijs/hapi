/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Batch = require('./batch');
var Details = require('./details');
var Invite = require('./invite');
var Last = require('./last');
var Session = require('./session');
var Project = require('./project');
var Storage = require('./storage');
var Stream = require('./stream');
var Suggestions = require('./suggestions');
var Task = require('./task');
var Tips = require('./tips');
var User = require('./user');


// API Server Endpoints

exports.endpoints = [

    { method: 'POST',   path: '/oauth/token',                   handler: Session.token,         data: Session.type.endpoint, authentication: 'optional', user: 'any', tos: 'none' },
    { method: 'GET',    path: '/oauth/client/:id',              handler: Session.client,        scope: 'login', user: 'none' },

    { method: 'GET',    path: '/profile',                       handler: User.get,              tos: 'none' },
    { method: 'POST',   path: '/profile',                       handler: User.post,             data: User.type.user, tos: 'none' },
    { method: 'POST',   path: '/profile/email',                 handler: User.email,            data: User.type.email, tos: 'none' },
    { method: 'GET',    path: '/contacts',                      handler: User.contacts,         query: ['exclude'], tos: 'none' },
    { method: 'GET',    path: '/who',                           handler: User.who,              tos: 'none' },

    { method: 'PUT',    path: '/user',                          handler: User.put,              query: ['invite'], data: User.type.put, scope: 'signup', user: 'none' },
    { method: 'POST',   path: '/user/:id/tos/:version',         handler: User.tos,              scope: 'tos', user: 'none' },
    { method: 'POST',   path: '/user/:id/link/:network',        handler: User.link,             data: User.type.link, scope: 'login', user: 'none' },
    { method: 'DELETE', path: '/user/:id/link/:network',        handler: User.unlink,           scope: 'login', user: 'none' },
    { method: 'POST',   path: '/user/:id/view/:path',           handler: User.view,             scope: 'view', user: 'none' },
    { method: 'GET',    path: '/user/lookup/:type/:id',         handler: User.lookup,           authentication: 'none' },
    { method: 'POST',   path: '/user/reminder',                 handler: User.reminder,         data: User.type.reminder, scope: 'reminder', user: 'none' },
    { method: 'DELETE', path: '/user',                          handler: User.del,              scope: 'quit', tos: 'none' },

    { method: 'GET',    path: '/projects',                      handler: Project.list },
    { method: 'GET',    path: '/project/:id',                   handler: Project.get },
    { method: 'POST',   path: '/project/:id',                   handler: Project.post,          query: ['position'], data: Project.type.post },
    { method: 'PUT',    path: '/project',                       handler: Project.put,           data: Project.type.put },
    { method: 'DELETE', path: '/project/:id',                   handler: Project.del },
    { method: 'GET',    path: '/project/:id/tips',              handler: Project.tips },
    { method: 'GET',    path: '/project/:id/suggestions',       handler: Project.suggestions },
    { method: 'POST',   path: '/project/:id/participants',      handler: Project.participants,  query: ['message'], data: Project.type.participants },
    { method: 'DELETE', path: '/project/:id/participants',      handler: Project.uninvite,      data: Project.type.uninvite },
    { method: 'DELETE', path: '/project/:id/participant/:user', handler: Project.uninvite },
    { method: 'POST',   path: '/project/:id/join',              handler: Project.join },

    { method: 'GET',    path: '/project/:id/tasks',             handler: Task.list },
    { method: 'GET',    path: '/task/:id',                      handler: Task.get },
    { method: 'POST',   path: '/task/:id',                      handler: Task.post,             query: ['position'], data: Task.type.post },
    { method: 'PUT',    path: '/project/:id/task',              handler: Task.put,              query: ['suggestion', 'position'],  data: Task.type.put },
    { method: 'DELETE', path: '/task/:id',                      handler: Task.del },

    { method: 'GET',    path: '/task/:id/details',              handler: Details.get,           query: ['since'] },
    { method: 'POST',   path: '/task/:id/detail',               handler: Details.post,          query: ['last'], data: Details.type },

    { method: 'DELETE', path: '/project/:id/suggestion/:drop',  handler: Suggestions.exclude },

    { method: 'GET',    path: '/project/:id/last',              handler: Last.getProject },
    { method: 'POST',   path: '/project/:id/last',              handler: Last.postProject },
    { method: 'GET',    path: '/task/:id/last',                 handler: Last.getTask },
    { method: 'POST',   path: '/task/:id/last',                 handler: Last.postTask },

    { method: 'GET',    path: '/storage/:id?',                  handler: Storage.get },
    { method: 'POST',   path: '/storage/:id',                   handler: Storage.post,          data: Storage.type },
    { method: 'DELETE', path: '/storage/:id',                   handler: Storage.del },

    { method: 'GET',    path: '/invite/:id',                    handler: Invite.get,            authentication: 'none'},
    { method: 'POST',   path: '/invite/:id/claim',              handler: Invite.claim },
    
    { method: 'POST',   path: '/stream/:id/project/:project',   handler: Stream.subscribe },
    { method: 'DELETE', path: '/stream/:id/project/:project',   handler: Stream.unsubscribe },
    
    { method: 'POST',   path: '/batch',                         handler: Batch.post,            data: Batch.type }
];
