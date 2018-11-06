'use strict';

const internals = {};


exports.route = function (settings) {

    if (!settings) {
        return null;
    }

    const security = settings;
    if (security.hsts) {
        if (security.hsts === true) {
            security._hsts = 'max-age=15768000';
        }
        else if (typeof security.hsts === 'number') {
            security._hsts = 'max-age=' + security.hsts;
        }
        else {
            security._hsts = 'max-age=' + (security.hsts.maxAge || 15768000);
            if (security.hsts.includeSubdomains || security.hsts.includeSubDomains) {
                security._hsts = security._hsts + '; includeSubDomains';
            }

            if (security.hsts.preload) {
                security._hsts = security._hsts + '; preload';
            }
        }
    }

    if (security.xframe) {
        if (security.xframe === true) {
            security._xframe = 'DENY';
        }
        else if (typeof security.xframe === 'string') {
            security._xframe = security.xframe.toUpperCase();
        }
        else if (security.xframe.rule === 'allow-from') {
            if (!security.xframe.source) {
                security._xframe = 'SAMEORIGIN';
            }
            else {
                security._xframe = 'ALLOW-FROM ' + security.xframe.source;
            }
        }
        else {
            security._xframe = security.xframe.rule.toUpperCase();
        }
    }

    return security;
};


exports.headers = function (request) {

    const response = request.response;
    const security = response.request.route.settings.security;

    if (security._hsts) {
        response._header('strict-transport-security', security._hsts, { override: false });
    }

    if (security._xframe) {
        response._header('x-frame-options', security._xframe, { override: false });
    }

    if (security.xss) {
        response._header('x-xss-protection', '1; mode=block', { override: false });
    }

    if (security.noOpen) {
        response._header('x-download-options', 'noopen', { override: false });
    }

    if (security.noSniff) {
        response._header('x-content-type-options', 'nosniff', { override: false });
    }

    if (security.referrer !== false) {
        response._header('referrer-policy', security.referrer, { override: false });
    }
};
