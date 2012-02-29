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


//  Proposed API Server Endpoints
/* 
    Notes: 
    In a tree, key order does not matter; but for production readability, alphabetical would be desirable.
        First level URIs are kept (mostly) in original order, subpaths attempt to be sorted alphabetically
    By convention, router attempts to match route with non-wildcards first.
    Using Lisp or YAML style whitespacing 
        Results in:
            increased info density = ρ = (content / px^2), where px = pixel
            increased SNR = ρ / ε, where ε is useless junk 
        But, Parenthetic Matching is a PITA w/o a good text editor.  Sometimes even w/ one...
        Increase or decrease tab width to adjust route/path readability.  
        My text editor has dotted columns for tab lengths making it super-easy to align & read.
    Switching to CoffeeScript would reduce the number of ['{', '}', ','] through optional punctuation.
        At cost of potentially higher typo/error rate.  Lint helps but is not a panacea.
    Additional contextual notes are shown below as inline comments // like this

    Lots of additional optimizations are possible (not utilized below):
        Overriding object w/ function
            route: { http_method: {} } // object
            route: { http_method: User.get } // function => { handler: User.get } no other options used
*/
exports.endpoints = {
    "/": { // this key ('/') is potentially redundant and may prevent resource nesting
        "/oauth": {
            "/client/:id": {
                post: { handler: Session.client, ... }},
            "/token": {
                post: { handler: Session.token, data: Session.type.endpoint, authentication: 'optional', user: 'any', tos: 'none' }}},
        "/profile": {
            base: User, // Special param:  handlers for sibling HTTP methods use convention:  base[http_method] = User.get
            opts: { tos: 'none' }, // default opts, inherited by descendent controllers
            // get: { tos: 'none' },  // not necessary, covered by existence of User.get;
            post: { data: User.type.user }, // handler unnecessary since following RESTful convention; tos inherited from parent.opts
            "/email": {
                post: { handler: User.email, data: User.type.email }}} // inherited tos param
        "/contacts": {
            get: { handler: User.contacts, query: ['exclude'], tos: 'none' }},
        "/who": {
            get: { handler: User.who, tos: 'none' }},
        "/user": {
            base: User,
            put: { query: ['invite'], data: User.type.put, scope: 'signup', user: 'none' },
            delete: { scope: 'quit', tos: 'none' }, // handler may be necessary depending if we decide against .del => HTTP DELETE
            "/lookup/:type/:id": {
                get: { handler: User.lookup, authentication: 'none' }}, 
            "/reminder": {
                post: { handler: User.reminder, data: User.type.reminder, scope: 'reminder', user: 'none' }},
            "/:id": {
                "/tos/:version": {
                    post: { handler: User.tos, scope: 'tos', user: 'none' }},
                "/link/:network": {
                    post: { handler: User.link, data: User.type.link, scope: 'login', user: 'none' },
                    delete: { handler: User.unlink, scope: 'login', user: 'none' }},
                "/view/:path": {
                    post: { handler: User.view, scope: 'view', user: 'none' }}}},
        "/projects": {
            get: { handler: Projects.list }, // override GET since using nonstandard handler
            put: { handler: Projects.put, data: Project.type.put }, // no base here to avoid conflict with /:id's base
            "/:id": {
                base: Projects, // See RATIONALE.md:Trading Subtleties for potential GOTCHA here.
                // get: { handler: Project.get }, // automagically used
                post: { query: ['position'], data: Project.type.post },
                delete: { handler: Project.del },
                "/join": {
                    post: { handler: Project.join }}},
                "/last": {
                    get: { handler: Last.getProject },
                    post: { handler: Last.postProject }},
                "/participants": {
                    post: { handler: Project.participants, query: ['message'], data: Project.type.participants },
                    delete: { handler: Project.uninvite, data: Project.type.uninvite }
                    "/:user": {
                        delete: { handler: Project.uninvite }}}
                "/suggestion": {
                    delete: { handler: Suggestions.exclude }},
                "/suggestions": {
                    get: { handler: Project.suggestions }},
                "/task": {
                    put: { handler: Task.put, query: ['suggestion', 'position'],  data: Task.type.put }}
                "/tasks": {
                    get: { handler: Task.list }},
                "/tips": {
                    get: { handler: Project.tips }}},
        "/task/:id": {
            base: Task,
            post: { query: ['position'], data: Task.type.post },
            delete: { handler: Task.del },
            "/details": {
                base: Details,
                get: { query: ['since'] },
                post: { query: ['last'], data: Details.type }},
            "/last": {
                get: { handler: Last.getTask },
                post: { handler: Last.postTask }}},
        "/storage": {
            get: { handler: Storage.get },
            "/:id": {
                base: Storage,
                // get: {} // auto
                post: { data: Storage.type },
                delete: { handler: Storage.del }}},
        "/invite/:id": {
            get: { handler: Invite.get, authentication: 'none' },
            "/claim": {
                post: { handler: Invite.claim }}},
        "/stream/:id/project/:project": {
            post: { handler: Stream.subscribe },
            delete: { handler: Stream.unsubscribe }},
        "/batch": { 
            post: { handler: Batch.post, data: Batch.type }}
    }
};
