import { RequestRoute } from './request';
import { RouteOptions } from './route';
import { Server } from './server';
import { Lifecycle } from './utils';

/**
 * one of
 * a single plugin name string.
 * an array of plugin name strings.
 * an object where each key is a plugin name and each matching value is a
 * {@link https://www.npmjs.com/package/semver version range string} which must match the registered
 *  plugin version.
 */
export type Dependencies = string | string[] | Record<string, string>;

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverregistrations)
 */
export interface PluginsListRegistered {
}

/**
 * An object of the currently registered plugins where each key is a registered plugin name and the value is an
 * object containing:
 * * version - the plugin version.
 * * name - the plugin name.
 * * options - (optional) options passed to the plugin during registration.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverregistrations)
 */
export interface PluginRegistered {
    /**
     * the plugin version.
     */
    version: string;

    /**
     * the plugin name.
     */
    name: string;

    /**
     * options used to register the plugin.
     */
    options: object;
}

export interface PluginsStates {
}

export interface PluginSpecificConfiguration {
}

export interface PluginNameVersion {
    /**
     * (required) the plugin name string. The name is used as a unique key. Published plugins (e.g. published in the npm
     * registry) should use the same name as the name field in their 'package.json' file. Names must be
     * unique within each application.
     */
    name: string;

    /**
     * optional plugin version. The version is only used informatively to enable other plugins to find out the versions loaded. The version should be the same as the one specified in the plugin's
     * 'package.json' file.
     */
    version?: string | undefined;
}

export interface PluginPackage {
    /**
     * Alternatively, the name and version can be included via the pkg property containing the 'package.json' file for the module which already has the name and version included
     */
    pkg: PluginNameVersion;
}

export interface PluginBase<T, D> {
    /**
     * (required) the registration function with the signature async function(server, options) where:
     * * server - the server object with a plugin-specific server.realm.
     * * options - any options passed to the plugin during registration via server.register().
     */
    register: (server: Server, options: T) => void | Promise<void>;

    /** (optional) if true, allows the plugin to be registered multiple times with the same server. Defaults to false. */
    multiple?: boolean | undefined;

    /** (optional) a string or an array of strings indicating a plugin dependency. Same as setting dependencies via server.dependency(). */
    dependencies?: Dependencies | undefined;

    /**
     * Allows defining semver requirements for node and hapi.
     * @default Allows all.
     */
    requirements?: {
        node?: string | undefined;
        hapi?: string | undefined;
    } | undefined;

    /** once - (optional) if true, will only register the plugin once per server. If set, overrides the once option passed to server.register(). Defaults to no override. */
    once?: boolean | undefined;

    /**
    * We need to use D within the PluginBase type to be able to infer it later on,
    * but this property has no concrete existence in the code.
    *
    * See https://github.com/Microsoft/TypeScript/wiki/FAQ#why-doesnt-type-inference-work-on-this-interface-interface-foot-- for details.
    */
    ___$type_of_plugin_decorations$___?: D;
}

/**
 * Plugins provide a way to organize application code by splitting the server logic into smaller components. Each
 * plugin can manipulate the server through the standard server interface, but with the added ability to sandbox
 * certain properties. For example, setting a file path in one plugin doesn't affect the file path set
 * in another plugin.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#plugins)
 *
 * The type T is the type of the plugin options.
 */
export type Plugin<T, D = void> = PluginBase<T, D> & (PluginNameVersion | PluginPackage);

/**
 * The realm object contains sandboxed server settings specific to each plugin or authentication strategy. When registering a plugin or an authentication scheme, a server object reference is provided
 * with a new server.realm container specific to that registration. It allows each plugin to maintain its own settings without leaking and affecting other plugins. For example, a plugin can set a
 * default file path for local resources without breaking other plugins' configured paths. When calling server.bind(), the active realm's settings.bind property is set which is then used by routes
 * and extensions added at the same level (server root or plugin).
 *
 * https://github.com/hapijs/hapi/blob/master/API.md#server.realm
 */
export interface ServerRealm {
    /** when the server object is provided as an argument to the plugin register() method, modifiers provides the registration preferences passed the server.register() method and includes: */
    modifiers: {
        /** routes preferences: */
        route: {
            /**
             * the route path prefix used by any calls to server.route() from the server. Note that if a prefix is used and the route path is set to '/', the resulting path will not include
             * the trailing slash.
             */
            prefix: string;
            /** the route virtual host settings used by any calls to server.route() from the server. */
            vhost: string;
        }
    };
    /** the realm of the parent server object, or null for the root server. */
    parent: ServerRealm | null;
    /** the active plugin name (empty string if at the server root). */
    plugin: string;
    /** the plugin options object passed at registration. */
    pluginOptions: object;
    /** plugin-specific state to be shared only among activities sharing the same active state. plugins is an object where each key is a plugin name and the value is the plugin state. */
    plugins: PluginsStates;
    /** settings overrides */
    settings: {
        files: {
            relativeTo: string;
        };
        bind: object;
    };
}

/**
 * Registration options (different from the options passed to the registration function):
 * * once - if true, subsequent registrations of the same plugin are skipped without error. Cannot be used with plugin options. Defaults to false. If not set to true, an error will be thrown the
 * second time a plugin is registered on the server.
 * * routes - modifiers applied to each route added by the plugin:
 * * * prefix - string added as prefix to any route path (must begin with '/'). If a plugin registers a child plugin the prefix is passed on to the child or is added in front of the child-specific
 * prefix.
 * * * vhost - virtual host string (or array of strings) applied to every route. The outer-most vhost overrides the any nested configuration.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverregisterplugins-options)
 */
export interface ServerRegisterOptions {
    /**
     * if true, subsequent registrations of the same plugin are skipped without error. Cannot be used with plugin options. Defaults to false. If not set to true, an error will be thrown the second
     * time a plugin is registered on the server.
     */
    once?: boolean | undefined;
    /**
     * modifiers applied to each route added by the plugin:
     */
    routes?: {
        /**
         * string added as prefix to any route path (must begin with '/'). If a plugin registers a child plugin the prefix is passed on to the child or is added in front of the child-specific prefix.
         */
        prefix: string;
        /**
         * virtual host string (or array of strings) applied to every route. The outer-most vhost overrides the any nested configuration.
         */
        vhost?: string | string[] | undefined;
    } | undefined;
}

export interface ServerRegisterPluginObjectDirect<T, D> extends ServerRegisterOptions {
    /**
     * a plugin object.
     */
    plugin: Plugin<T, D>;
    /**
     * options passed to the plugin during registration.
     */
    options?: T | undefined;
}

export interface ServerRegisterPluginObjectWrapped<T, D> extends ServerRegisterOptions {
    /**
     * a plugin object.
     */
    plugin: { plugin: Plugin<T, D> };
    /**
     * options passed to the plugin during registration.
     */
    options?: T | undefined;
}

/**
 * An object with the following:
 * * plugin - a plugin object or a wrapped plugin loaded module.
 * * options - (optional) options passed to the plugin during registration.
 * * once - if true, subsequent registrations of the same plugin are skipped without error. Cannot be used with plugin options. Defaults to false. If not set to true, an error will be thrown the
 * second time a plugin is registered on the server.
 * * routes - modifiers applied to each route added by the plugin:
 * * * prefix - string added as prefix to any route path (must begin with '/'). If a plugin registers a child plugin the prefix is passed on to the child or is added in front of the child-specific
 * prefix.
 * * * vhost - virtual host string (or array of strings) applied to every route. The outer-most vhost overrides the any nested configuration.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverregisterplugins-options)
 *
 * The type parameter T is the type of the plugin configuration options.
 */
export type ServerRegisterPluginObject<T, D = void> =
    ServerRegisterPluginObjectDirect<T, D> |
    ServerRegisterPluginObjectWrapped<T, D>;

export type ServerRegisterPluginObjectArray<T, U, V, W, X, Y, Z> = (
    ServerRegisterPluginObject<T> |
    ServerRegisterPluginObject<U> |
    ServerRegisterPluginObject<V> |
    ServerRegisterPluginObject<W> |
    ServerRegisterPluginObject<X> |
    ServerRegisterPluginObject<Y> |
    ServerRegisterPluginObject<Z>
)[];

/**
 * The method function can have a defaults object or function property. If the property is set to an object, that object is used as the default route config for routes using this handler.
 * If the property is set to a function, the function uses the signature function(method) and returns the route default configuration.
 */
export interface HandlerDecorationMethod {
    (route: RequestRoute, options: any): Lifecycle.Method;
    defaults?: RouteOptions | ((method: any) => RouteOptions) | undefined;
}

/**
 * The general case for decorators added via server.decorate.
 */
export type DecorationMethod<T> = (this: T, ...args: any[]) => any;

/**
 * An empty interface to allow typings of custom plugin properties.
 */

export interface PluginProperties {
}

export type DecorateName = string | symbol;
