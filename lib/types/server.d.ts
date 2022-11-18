import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';

import {
    PolicyOptionVariants,
    PolicyOptions,
    EnginePrototype,
    Policy,
    ClientApi,
    ClientOptions
} from '@hapi/catbox';
import { SealOptions, SealOptionsSub } from '@hapi/iron';
import { MimosOptions } from '@hapi/mimos';
import { Podium } from '@hapi/podium';
import { RequestOptions as ShotRequestOptions, ResponseObject as ShotResponseObject } from '@hapi/shot';
import { ValidationOptions, ObjectSchema, Schema, Root } from 'joi';

import {
    Dependencies,
    PluginsListRegistered,
    PluginSpecificConfiguration,
    Plugin,
    PluginsStates
} from './plugin';
import {
    AuthArtifacts,
    MergeType,
    AuthCredentials,
    ReqRef,
    ReqRefDefaults,
    MergeRefs,
    Request,
    RequestAuth,
    RequestRoute
} from './request';
import { ResponseToolkit, AuthenticationData } from './response';
import {
    RouteOptionsAccess,
    InternalRouteOptionType,
    RouteOptionTypes,
    RouteOptions,
    PayloadCompressionDecoderSettings,
    RouteCompressionEncoderSettings
} from './route';
import {
    Lifecycle,
    RequestApplicationState,
    ServerApplicationState,
    Utils
 } from './utils';

/**
 * The scheme options argument passed to server.auth.strategy() when instantiation a strategy.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthschemename-scheme)
 */
export type ServerAuthSchemeOptions = object;

/**
 * the method implementing the scheme with signature function(server, options) where:
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthschemename-scheme)
 * @param server - a reference to the server object the scheme is added to.
 * @param options - (optional) the scheme options argument passed to server.auth.strategy() when instantiation a strategy.
 */
export type ServerAuthScheme<
    // tslint:disable-next-line no-unnecessary-generics
    Options extends ServerAuthSchemeOptions = ServerAuthSchemeOptions,
    // tslint:disable-next-line no-unnecessary-generics
    Refs extends ReqRef = ReqRefDefaults
> = (server: Server, options?: Options) => ServerAuthSchemeObject<Refs>;

export interface ServerAuthSchemeObjectApi {}

/**
 * The scheme method must return an object with the following
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#authentication-scheme)
 */

export interface ServerAuthSchemeObject<Refs extends ReqRef = ReqRefDefaults> {
    /**
     * optional object which is exposed via the [server.auth.api](https://github.com/hapijs/hapi/blob/master/API.md#server.auth.api) object.
     */
    api?: MergeRefs<Refs>['AuthApi'] | undefined;

    /**
     * A lifecycle method function called for each incoming request configured with the authentication scheme. The
     * method is provided with two special toolkit methods for returning an authenticated or an unauthenticated result:
     * * h.authenticated() - indicate request authenticated successfully.
     * * h.unauthenticated() - indicate request failed to authenticate.
     * @param request the request object.
     * @param h the ResponseToolkit
     * @return the Lifecycle.ReturnValue
     */
    authenticate(request: Request<Refs>, h: ResponseToolkit<Refs>): Lifecycle.ReturnValue<Refs>;

    /**
     * A lifecycle method to authenticate the request payload.
     * When the scheme payload() method returns an error with a message, it means payload validation failed due to bad
     * payload. If the error has no message but includes a scheme name (e.g. Boom.unauthorized(null, 'Custom')),
     * authentication may still be successful if the route auth.payload configuration is set to 'optional'.
     * @param request the request object.
     * @param h the ResponseToolkit
     * @return the Lifecycle.ReturnValue
     */
    payload?(request: Request<Refs>, h: ResponseToolkit<Refs>): Lifecycle.ReturnValue<Refs>;

    /**
     * A lifecycle method to decorate the response with authentication headers before the response headers or payload is written.
     * @param request the request object.
     * @param h the ResponseToolkit
     * @return the Lifecycle.ReturnValue
     */
    response?(request: Request<Refs>, h: ResponseToolkit<Refs>): Lifecycle.ReturnValue<Refs>;

    /**
     * a method used to verify the authentication credentials provided
     * are still valid (e.g. not expired or revoked after the initial authentication).
     * the method throws an `Error` when the credentials passed are no longer valid (e.g. expired or
     * revoked). Note that the method does not have access to the original request, only to the
     * credentials and artifacts produced by the `authenticate()` method.
     */
    verify?(
        auth: RequestAuth<
            MergeRefs<Refs>['AuthUser'],
            MergeRefs<Refs>['AuthApp'],
            MergeRefs<Refs>['AuthCredentialsExtra'],
            MergeRefs<Refs>['AuthArtifactsExtra']
        >
    ): Promise<void>;

    /**
     * An object with the following keys:
     * * payload
     */
    options?: {
        /**
         * if true, requires payload validation as part of the scheme and forbids routes from disabling payload auth validation. Defaults to false.
         */
        payload?: boolean | undefined;
    } | undefined;
}

/**
 * An authentication configuration object using the same format as the route auth handler options.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthdefaultoptions)
 */

export interface ServerAuthConfig extends RouteOptionsAccess {
}

export interface ServerAuth {
    /**
     * An object where each key is an authentication strategy name and the value is the exposed strategy API.
     * Available only when the authentication scheme exposes an API by returning an api key in the object
     * returned from its implementation function.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthapi)
     */
    api: Utils.Dictionary<ServerAuthSchemeObjectApi>;

    /**
     * Contains the default authentication configuration is a default strategy was set via
     * [server.auth.default()](https://github.com/hapijs/hapi/blob/master/API.md#server.auth.default()).
     */
    readonly settings: {
        default: ServerAuthConfig;
    };

    /**
     * Sets a default strategy which is applied to every route where:
     * @param options - one of:
     * * a string with the default strategy name
     * * an authentication configuration object using the same format as the route auth handler options.
     * @return void.
     * The default does not apply when a route config specifies auth as false, or has an authentication strategy
     * configured (contains the strategy or strategies authentication settings). Otherwise, the route authentication
     * config is applied to the defaults.
     * Note that if the route has authentication configured, the default only applies at the time of adding the route,
     * not at runtime. This means that calling server.auth.default() after adding a route with some authentication
     * config will have no impact on the routes added prior. However, the default will apply to routes added
     * before server.auth.default() is called if those routes lack any authentication config.
     * The default auth strategy configuration can be accessed via server.auth.settings.default. To obtain the active
     * authentication configuration of a route, use server.auth.lookup(request.route).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthdefaultoptions)
     */
    default(options: string | ServerAuthConfig): void;

    /**
     * Registers an authentication scheme where:
     * @param name the scheme name.
     * @param scheme - the method implementing the scheme with signature function(server, options) where:
     * * server - a reference to the server object the scheme is added to.
     * * options - (optional) the scheme options argument passed to server.auth.strategy() when instantiation a strategy.
     * @return void.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthschemename-scheme)
     */

    scheme <
        Refs extends ReqRef = ReqRefDefaults,
        Options extends object = {}
    // tslint:disable-next-line no-unnecessary-generics
    >(name: string, scheme: ServerAuthScheme<Options, Refs>): void;

    /**
     * Registers an authentication strategy where:
     * @param name - the strategy name.
     * @param scheme - the scheme name (must be previously registered using server.auth.scheme()).
     * @param options - scheme options based on the scheme requirements.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverauthstrategyname-scheme-options)
     */
    strategy(
        name: MergeType<InternalRouteOptionType, RouteOptionTypes>['Strategy'],
        scheme: string,
        options?: object
    ): void;

    /**
     * Tests a request against an authentication strategy where:
     * @param strategy - the strategy name registered with server.auth.strategy().
     * @param request - the request object.
     * @return an object containing the authentication credentials and artifacts if authentication was successful, otherwise throws an error.
     * Note that the test() method does not take into account the route authentication configuration. It also does not
     * perform payload authentication. It is limited to the basic strategy authentication execution. It does not
     * include verifying scope, entity, or other route properties.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverauthteststrategy-request)
     */
    test(strategy: string, request: Request): Promise<AuthenticationData>;

    /**
     * Verify a request's authentication credentials against an authentication strategy.
     * Returns nothing if verification was successful, otherwise throws an error.
     *
     * Note that the `verify()` method does not take into account the route authentication configuration
     * or any other information from the request other than the `request.auth` object. It also does not
     * perform payload authentication. It is limited to verifying that the previously valid credentials
     * are still valid (e.g. have not been revoked or expired). It does not include verifying scope,
     * entity, or other route properties.
     */
    // tslint:disable-next-line no-unnecessary-generics
    verify <Refs extends ReqRef = ReqRefDefaults>(request: Request<Refs>): Promise<void>;
}

export type CachePolicyOptions<T> = PolicyOptionVariants<T> & {
    /**
     * @default '_default'
     */
    cache?: string | undefined;
    segment?: string | undefined;
};

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servercacheoptions)
 */
export interface ServerCache {
    /**
     * Provisions a cache segment within the server cache facility where:
     * @param options - [catbox policy](https://github.com/hapijs/catbox#policy) configuration where:
     * * expiresIn - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with expiresAt.
     * * expiresAt - time of day expressed in 24h notation using the 'HH:MM' format, at which point all cache records expire. Uses local time. Cannot be used together with expiresIn.
     * * generateFunc - a function used to generate a new cache item if one is not found in the cache when calling get(). The method's signature is async function(id, flags) where:
     * - `id` - the `id` string or object provided to the `get()` method.
     * - `flags` - an object used to pass back additional flags to the cache where:
     * - `ttl` - the cache ttl value in milliseconds. Set to `0` to skip storing in the cache. Defaults to the cache global policy.
     * * staleIn - number of milliseconds to mark an item stored in cache as stale and attempt to regenerate it when generateFunc is provided. Must be less than expiresIn.
     * * staleTimeout - number of milliseconds to wait before checking if an item is stale.
     * * generateTimeout - number of milliseconds to wait before returning a timeout error when the generateFunc function takes too long to return a value. When the value is eventually returned, it
     *     is stored in the cache for future requests. Required if generateFunc is present. Set to false to disable timeouts which may cause all get() requests to get stuck forever.
     * * generateOnReadError - if false, an upstream cache read error will stop the cache.get() method from calling the generate function and will instead pass back the cache error. Defaults to true.
     * * generateIgnoreWriteError - if false, an upstream cache write error when calling cache.get() will be passed back with the generated value when calling. Defaults to true.
     * * dropOnError - if true, an error or timeout in the generateFunc causes the stale value to be evicted from the cache. Defaults to true.
     * * pendingGenerateTimeout - number of milliseconds while generateFunc call is in progress for a given id, before a subsequent generateFunc call is allowed. Defaults to 0 (no blocking of
     *     concurrent generateFunc calls beyond staleTimeout).
     * * cache - the cache name configured in server.cache. Defaults to the default cache.
     * * segment - string segment name, used to isolate cached items within the cache partition. When called within a plugin, defaults to '!name' where 'name' is the plugin name. When called within a
     *     server method, defaults to '#name' where 'name' is the server method name. Required when called outside of a plugin.
     * * shared - if true, allows multiple cache provisions to share the same segment. Default to false.
     * @return Catbox Policy.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servercacheoptions)
     */
    <T, O extends CachePolicyOptions<T> = CachePolicyOptions<T>>(options: O): Policy<T, O>;

    /**
     * Provisions a server cache as described in server.cache where:
     * @param options - same as the server cache configuration options.
     * @return Return value: none.
     * Note that if the server has been initialized or started, the cache will be automatically started to match the state of any other provisioned server cache.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-servercacheprovisionoptions)
     */
    provision(options: ServerOptionsCache): Promise<void>;
}

/**
 * an event name string.
 * an event options object.
 * a podium emitter object.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servereventevents)
 */
export type ServerEventsApplication = string | ServerEventsApplicationObject | Podium;

/**
 * Object that it will be used in Event
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servereventevents)
 */
export interface ServerEventsApplicationObject {
    /** the event name string (required). */
    name: string;
    /** a string or array of strings specifying the event channels available. Defaults to no channel restrictions (event updates can specify a channel or not). */
    channels?: string | string[] | undefined;
    /**
     * if true, the data object passed to server.events.emit() is cloned before it is passed to the listeners (unless an override specified by each listener). Defaults to false (data is passed as-is).
     */
    clone?: boolean | undefined;
    /**
     * if true, the data object passed to server.event.emit() must be an array and the listener method is called with each array element passed as a separate argument (unless an override specified
     * by each listener). This should only be used when the emitted data structure is known and predictable. Defaults to false (data is emitted as a single argument regardless of its type).
     */
    spread?: boolean | undefined;
    /**
     * if true and the criteria object passed to server.event.emit() includes tags, the tags are mapped to an object (where each tag string is the key and the value is true) which is appended to
     * the arguments list at the end. A configuration override can be set by each listener. Defaults to false.
     */
    tags?: boolean | undefined;
    /**
     * if true, the same event name can be registered multiple times where the second registration is ignored. Note that if the registration config is changed between registrations, only the first
     * configuration is used. Defaults to false (a duplicate registration will throw an error).
     */
    shared?: boolean | undefined;
}

/**
 * A criteria object with the following optional keys (unless noted otherwise):
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servereventsoncriteria-listener)
 *
 * The type parameter T is the type of the name of the event.
 */
export interface ServerEventCriteria<T> {
    /** (required) the event name string. */
    name: T;
    /**
     * a string or array of strings specifying the event channels to subscribe to. If the event registration specified a list of allowed channels, the channels array must match the allowed
     * channels. If channels are specified, event updates without any channel designation will not be included in the subscription. Defaults to no channels filter.
     */
    channels?: string | string[] | undefined;
    /** if true, the data object passed to server.event.emit() is cloned before it is passed to the listener method. Defaults to the event registration option (which defaults to false). */
    clone?: boolean | undefined;
    /**
     * a positive integer indicating the number of times the listener can be called after which the subscription is automatically removed. A count of 1 is the same as calling server.events.once().
     * Defaults to no limit.
     */
    count?: number | undefined;
    /**
     * filter - the event tags (if present) to subscribe to which can be one of:
     * * a tag string.
     * * an array of tag strings.
     * * an object with the following:
     * * * tags - a tag string or array of tag strings.
     * * * all - if true, all tags must be present for the event update to match the subscription. Defaults to false (at least one matching tag).
     */
    filter?: string | string[] | { tags: string | string[]  | undefined, all?: boolean  | undefined } | undefined;
    /**
     * if true, and the data object passed to server.event.emit() is an array, the listener method is called with each array element passed as a separate argument. This should only be used
     * when the emitted data structure is known and predictable. Defaults to the event registration option (which defaults to false).
     */
    spread?: boolean | undefined;
    /**
     * if true and the criteria object passed to server.event.emit() includes tags, the tags are mapped to an object (where each tag string is the key and the value is true) which is appended
     * to the arguments list at the end. Defaults to the event registration option (which defaults to false).
     */
    tags?: boolean | undefined;
}

export interface LogEvent {
    /** the event timestamp. */
    timestamp: string;
    /** an array of tags identifying the event (e.g. ['error', 'http']) */
    tags: string[];
    /** set to 'internal' for internally generated events, otherwise 'app' for events generated by server.log() */
    channel: 'internal' | 'app';
    /** the request identifier. */
    request: string;
    /** event-specific information. Available when event data was provided and is not an error. Errors are passed via error. */
    data: object;
    /** the error object related to the event if applicable. Cannot appear together with data */
    error: object;
}

export interface RequestEvent {
    /** the event timestamp. */
    timestamp: string;
    /** an array of tags identifying the event (e.g. ['error', 'http']) */
    tags: string[];
    /** set to 'internal' for internally generated events, otherwise 'app' for events generated by server.log() */
    channel: 'internal' | 'app' | 'error';
    /** event-specific information. Available when event data was provided and is not an error. Errors are passed via error. */
    data: object;
    /** the error object related to the event if applicable. Cannot appear together with data */
    error: object;
}

export type LogEventHandler = (event: LogEvent, tags: { [key: string]: true }) => void;
export type RequestEventHandler = (request: Request, event: RequestEvent, tags: { [key: string]: true }) => void;
export type ResponseEventHandler = (request: Request) => void;
export type RouteEventHandler = (route: RequestRoute) => void;
export type StartEventHandler = () => void;
export type StopEventHandler = () => void;

export interface PodiumEvent<K extends string, T> {
    emit(criteria: K, listener: (value: T) => void): void;

    on(criteria: K, listener: (value: T) => void): void;

    once(criteria: K, listener: (value: T) => void): void;

    once(criteria: K): Promise<T>;

    removeListener(criteria: K, listener: Podium.Listener): this;

    removeAllListeners(criteria: K): this;

    hasListeners(criteria: K): this;
}

/**
 * Access: podium public interface.
 * The server events emitter. Utilizes the podium with support for event criteria validation, channels, and filters.
 * Use the following methods to interact with server.events:
 * [server.event(events)](https://github.com/hapijs/hapi/blob/master/API.md#server.event()) - register application events.
 * [server.events.emit(criteria, data)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.emit()) - emit server events.
 * [server.events.on(criteria, listener)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.on()) - subscribe to all events.
 * [server.events.once(criteria, listener)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.once()) - subscribe to
 * Other methods include: server.events.removeListener(name, listener), server.events.removeAllListeners(name), and server.events.hasListeners(name).
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
 */
export interface ServerEvents extends Podium {
    /**
     * Subscribe to an event where:
     * @param criteria - the subscription criteria which must be one of:
     * * event name string which can be any of the built-in server events
     * * a custom application event registered with server.event().
     * * a criteria object
     * @param listener - the handler method set to receive event updates. The function signature depends on the event argument, and the spread and tags options.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servereventsoncriteria-listener)
     * See ['log' event](https://github.com/hapijs/hapi/blob/master/API.md#-log-event)
     * See ['request' event](https://github.com/hapijs/hapi/blob/master/API.md#-request-event)
     * See ['response' event](https://github.com/hapijs/hapi/blob/master/API.md#-response-event)
     * See ['route' event](https://github.com/hapijs/hapi/blob/master/API.md#-route-event)
     * See ['start' event](https://github.com/hapijs/hapi/blob/master/API.md#-start-event)
     * See ['stop' event](https://github.com/hapijs/hapi/blob/master/API.md#-stop-event)
     */
    on(criteria: 'log' | ServerEventCriteria<'log'>, listener: LogEventHandler): this;

    on(criteria: 'request' | ServerEventCriteria<'request'>, listener: RequestEventHandler): this;

    on(criteria: 'response' | ServerEventCriteria<'response'>, listener: ResponseEventHandler): this;

    on(criteria: 'route' | ServerEventCriteria<'route'>, listener: RouteEventHandler): this;

    on(criteria: 'start' | ServerEventCriteria<'start'>, listener: StartEventHandler): this;

    on(criteria: 'stop' | ServerEventCriteria<'stop'>, listener: StopEventHandler): this;

    /**
     * Same as calling [server.events.on()](https://github.com/hapijs/hapi/blob/master/API.md#server.events.on()) with the count option set to 1.
     * @param criteria - the subscription criteria which must be one of:
     * * event name string which can be any of the built-in server events
     * * a custom application event registered with server.event().
     * * a criteria object
     * @param listener - the handler method set to receive event updates. The function signature depends on the event argument, and the spread and tags options.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servereventsoncecriteria-listener)
     */
    once(criteria: 'log' | ServerEventCriteria<'log'>, listener: LogEventHandler): this;

    once(criteria: 'request' | ServerEventCriteria<'request'>, listener: RequestEventHandler): this;

    once(criteria: 'response' | ServerEventCriteria<'response'>, listener: ResponseEventHandler): this;

    once(criteria: 'route' | ServerEventCriteria<'route'>, listener: RouteEventHandler): this;

    once(criteria: 'start' | ServerEventCriteria<'start'>, listener: StartEventHandler): this;

    once(criteria: 'stop' | ServerEventCriteria<'stop'>, listener: StopEventHandler): this;

    /**
     * Same as calling server.events.on() with the count option set to 1.
     * @param criteria - the subscription criteria which must be one of:
     * * event name string which can be any of the built-in server events
     * * a custom application event registered with server.event().
     * * a criteria object
     * @return Return value: a promise that resolves when the event is emitted.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-servereventsoncecriteria)
     */
    once(criteria: string | ServerEventCriteria<string>): Promise<any>;

    /**
     * The follow method is only mentioned in Hapi API. The doc about that method can be found [here](https://github.com/hapijs/podium/blob/master/API.md#podiumremovelistenername-listener)
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
     */
    removeListener(name: string, listener: Podium.Listener): this;

    /**
     * The follow method is only mentioned in Hapi API. The doc about that method can be found [here](https://github.com/hapijs/podium/blob/master/API.md#podiumremovealllistenersname)
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
     */
    removeAllListeners(name: string): this;

    /**
     * The follow method is only mentioned in Hapi API. The doc about that method can be found [here](https://github.com/hapijs/podium/blob/master/API.md#podiumhaslistenersname)
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
     */
    hasListeners(name: string): boolean;
}

/**
 * The extension point event name. The available extension points include the request extension points as well as the following server extension points:
 * 'onPreStart' - called before the connection listeners are started.
 * 'onPostStart' - called after the connection listeners are started.
 * 'onPreStop' - called before the connection listeners are stopped.
 * 'onPostStop' - called after the connection listeners are stopped.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevents)
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#request-lifecycle)
 */
export type ServerExtType = 'onPreStart' | 'onPostStart' | 'onPreStop' | 'onPostStop';
export type RouteRequestExtType = 'onPreAuth'
    | 'onCredentials'
    | 'onPostAuth'
    | 'onPreHandler'
    | 'onPostHandler'
    | 'onPreResponse'
    | 'onPostResponse';

export type ServerRequestExtType =
    RouteRequestExtType
    | 'onRequest';

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevents)
 * Registers an extension function in one of the request lifecycle extension points where:
 * @param events - an object or array of objects with the following:
 * * type - (required) the extension point event name. The available extension points include the request extension points as well as the following server extension points:
 * * * 'onPreStart' - called before the connection listeners are started.
 * * * 'onPostStart' - called after the connection listeners are started.
 * * * 'onPreStop' - called before the connection listeners are stopped.
 * * * 'onPostStop' - called after the connection listeners are stopped.
 * * method - (required) a function or an array of functions to be executed at a specified point during request processing. The required extension function signature is:
 * * * server extension points: async function(server) where:
 * * * * server - the server object.
 * * * * this - the object provided via options.bind or the current active context set with server.bind().
 * * * request extension points: a lifecycle method.
 * * options - (optional) an object with the following:
 * * * before - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
 * * * after - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
 * * * bind - a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
 * * * sandbox - if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level extensions, or
 *     when adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to.
 * @return void
 */
export interface ServerExtEventsObject {
    /**
     * (required) the extension point event name. The available extension points include the request extension points as well as the following server extension points:
     * * 'onPreStart' - called before the connection listeners are started.
     * * 'onPostStart' - called after the connection listeners are started.
     * * 'onPreStop' - called before the connection listeners are stopped.
     */
    type: ServerExtType;
    /**
     * (required) a function or an array of functions to be executed at a specified point during request processing. The required extension function signature is:
     * * server extension points: async function(server) where:
     * * * server - the server object.
     * * * this - the object provided via options.bind or the current active context set with server.bind().
     * * request extension points: a lifecycle method.
     */
    method: ServerExtPointFunction | ServerExtPointFunction[];
    options?: ServerExtOptions | undefined;
}

export interface RouteExtObject<Refs extends ReqRef = ReqRefDefaults> {
    method: Lifecycle.Method<Refs>;
    options?: ServerExtOptions | undefined;
}

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevents)
 * Registers an extension function in one of the request lifecycle extension points where:
 * @param events - an object or array of objects with the following:
 * * type - (required) the extension point event name. The available extension points include the request extension points as well as the following server extension points:
 * * * 'onPreStart' - called before the connection listeners are started.
 * * * 'onPostStart' - called after the connection listeners are started.
 * * * 'onPreStop' - called before the connection listeners are stopped.
 * * * 'onPostStop' - called after the connection listeners are stopped.
 * * method - (required) a function or an array of functions to be executed at a specified point during request processing. The required extension function signature is:
 * * * server extension points: async function(server) where:
 * * * * server - the server object.
 * * * * this - the object provided via options.bind or the current active context set with server.bind().
 * * * request extension points: a lifecycle method.
 * * options - (optional) an object with the following:
 * * * before - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
 * * * after - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
 * * * bind - a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
 * * * sandbox - if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level extensions, or
 *     when adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to.
 * @return void
 */
export interface ServerExtEventsRequestObject {
    /**
     * (required) the extension point event name. The available extension points include the request extension points as well as the following server extension points:
     * * 'onPreStart' - called before the connection listeners are started.
     * * 'onPostStart' - called after the connection listeners are started.
     * * 'onPreStop' - called before the connection listeners are stopped.
     * * 'onPostStop' - called after the connection listeners are stopped.
     */
    type: ServerRequestExtType;
    /**
     * (required) a function or an array of functions to be executed at a specified point during request processing. The required extension function signature is:
     * * server extension points: async function(server) where:
     * * * server - the server object.
     * * * this - the object provided via options.bind or the current active context set with server.bind().
     * * request extension points: a lifecycle method.
     */
    method: Lifecycle.Method | Lifecycle.Method[];
    /**
     * (optional) an object with the following:
     * * before - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
     * * after - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
     * * bind - a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
     * * sandbox - if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level extensions,
     * or when adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to.
     */
    options?: ServerExtOptions | undefined;
}

export type ServerExtPointFunction = (server: Server) => void;

/**
 * An object with the following:
 * * before - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
 * * after - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
 * * bind - a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
 * * sandbox - if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level extensions, or
 * when adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to. For context [See
 * docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevents)
 */
export interface ServerExtOptions {
    /**
     * a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
     */
    before?: string | string[] | undefined;
    /**
     * a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
     */
    after?: string | string[] | undefined;
    /**
     * a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
     */
    bind?: object | undefined;
    /**
     * if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level extensions, or when
     * adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to.
     */
    sandbox?: 'server' | 'plugin' | undefined;
}

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverinfo)
 * An object containing information about the server where:
 */
export interface ServerInfo {
    /**
     * a unique server identifier (using the format '{hostname}:{pid}:{now base36}').
     */
    id: string;

    /**
     * server creation timestamp.
     */
    created: number;

    /**
     * server start timestamp (0 when stopped).
     */
    started: number;

    /**
     * the connection [port](https://github.com/hapijs/hapi/blob/master/API.md#server.options.port) based on the following rules:
     *  * before the server has been started: the configured port value.
     *  * after the server has been started: the actual port assigned when no port is configured or was set to 0.
     */
    port: number | string;

    /**
     * The [host](https://github.com/hapijs/hapi/blob/master/API.md#server.options.host) configuration value.
     */
    host: string;

    /**
     * the active IP address the connection was bound to after starting. Set to undefined until the server has been
     * started or when using a non TCP port (e.g. UNIX domain socket).
     */
    address: undefined | string;

    /**
     *  the protocol used:
     * * 'http' - HTTP.
     * * 'https' - HTTPS.
     * * 'socket' - UNIX domain socket or Windows named pipe.
     */
    protocol: 'http' | 'https' | 'socket';

    /**
     * a string representing the connection (e.g. 'http://example.com:8080' or 'socket:/unix/domain/socket/path'). Contains
     * the uri value if set, otherwise constructed from the available settings. If no port is configured or is set
     * to 0, the uri will not include a port component until the server is started.
     */
    uri: string;
}

/**
 * An object with:
 * * method - (optional) the request HTTP method (e.g. 'POST'). Defaults to 'GET'.
 * * url - (required) the request URL. If the URI includes an authority (e.g. 'example.com:8080'), it is used to automatically set an HTTP 'Host' header, unless one was specified in headers.
 * * headers - (optional) an object with optional request headers where each key is the header name and the value is the header content. Defaults to no additions to the default shot headers.
 * * payload - (optional) an string, buffer or object containing the request payload. In case of an object it will be converted to a string for you. Defaults to no payload. Note that payload
 * processing defaults to 'application/json' if no 'Content-Type' header provided.
 * * credentials - (optional) an credentials object containing authentication information. The credentials are used to bypass the default authentication strategies, and are validated directly as if
 * they were received via an authentication scheme. Defaults to no credentials.
 * * artifacts - (optional) an artifacts object containing authentication artifact information. The artifacts are used to bypass the default authentication strategies, and are validated directly as
 * if they were received via an authentication scheme. Ignored if set without credentials. Defaults to no artifacts.
 * * app - (optional) sets the initial value of request.app, defaults to {}.
 * * plugins - (optional) sets the initial value of request.plugins, defaults to {}.
 * * allowInternals - (optional) allows access to routes with config.isInternal set to true. Defaults to false.
 * * remoteAddress - (optional) sets the remote address for the incoming connection.
 * * simulate - (optional) an object with options used to simulate client request stream conditions for testing:
 * * error - if true, emits an 'error' event after payload transmission (if any). Defaults to false.
 * * close - if true, emits a 'close' event after payload transmission (if any). Defaults to false.
 * * end - if false, does not end the stream. Defaults to true.
 * * split - indicates whether the request payload will be split into chunks. Defaults to undefined, meaning payload will not be chunked.
 * * validate - (optional) if false, the options inputs are not validated. This is recommended for run-time usage of inject() to make it perform faster where input validation can be tested
 * separately.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverinjectoptions)
 * For context [Shot module](https://github.com/hapijs/shot)
 */
export interface ServerInjectOptions extends ShotRequestOptions {
    /**
     * Authentication bypass options.
     */
    auth?: {
        /**
         * The authentication strategy name matching the provided credentials.
         */
        strategy: string;
        /**
         * The credentials are used to bypass the default authentication strategies,
         * and are validated directly as if they were received via an authentication scheme.
         */
        credentials: AuthCredentials;
        /**
         * The artifacts are used to bypass the default authentication strategies,
         * and are validated directly as if they were received via an authentication scheme. Defaults to no artifacts.
         */
        artifacts?: AuthArtifacts | undefined;
    } | undefined;
    /**
     * sets the initial value of request.app, defaults to {}.
     */
    app?: RequestApplicationState | undefined;
    /**
     * sets the initial value of request.plugins, defaults to {}.
     */
    plugins?: PluginsStates | undefined;
    /**
     * allows access to routes with config.isInternal set to true. Defaults to false.
     */
    allowInternals?: boolean | undefined;
}

/**
 * A response object with the following properties:
 * * statusCode - the HTTP status code.
 * * headers - an object containing the headers set.
 * * payload - the response payload string.
 * * rawPayload - the raw response payload buffer.
 * * raw - an object with the injection request and response objects:
 * * req - the simulated node request object.
 * * res - the simulated node response object.
 * * result - the raw handler response (e.g. when not a stream or a view) before it is serialized for transmission. If not available, the value is set to payload. Useful for inspection and reuse of
 * the internal objects returned (instead of parsing the response string).
 * * request - the request object.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverinjectoptions)
 * For context [Shot module](https://github.com/hapijs/shot)
 */
export interface ServerInjectResponse<Result = object> extends ShotResponseObject {
    /**
     * the raw handler response (e.g. when not a stream or a view) before it is serialized for transmission. If not available, the value is set to payload. Useful for inspection and reuse of the
     * internal objects returned (instead of parsing the response string).
     */
    result: Result | undefined;
    /**
     * the request object.
     */
    request: Request;
}

/**
 * The method function with a signature async function(...args, [flags]) where:
 * * ...args - the method function arguments (can be any number of arguments or none).
 * * flags - when caching is enabled, an object used to set optional method result flags:
 * * * ttl - 0 if result is valid but cannot be cached. Defaults to cache policy.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
 */
export type ServerMethod = (...args: any[]) => any;

/**
 * The same cache configuration used in server.cache().
 * The generateTimeout option is required.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servercacheoptions)
 */
export interface ServerMethodCache extends PolicyOptions<any> {
    generateTimeout: number | false;
}

/**
 * Configuration object:
 * * bind - a context object passed back to the method function (via this) when called. Defaults to active context (set via server.bind() when the method is registered. Ignored if the method is an
 * arrow function.
 * * cache - the same cache configuration used in server.cache(). The generateTimeout option is required.
 * * generateKey - a function used to generate a unique key (for caching) from the arguments passed to the method function (the flags argument is not passed as input). The server will automatically
 * generate a unique key if the function's arguments are all of types 'string', 'number', or 'boolean'. However if the method uses other types of arguments, a key generation function must be provided
 * which takes the same arguments as the function and returns a unique string (or null if no key can be generated). For reference [See
 * docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
 */
export interface ServerMethodOptions {
    /**
     * a context object passed back to the method function (via this) when called. Defaults to active context (set via server.bind() when the method is registered. Ignored if the method is an arrow
     * function.
     */
    bind?: object | undefined;
    /**
     * the same cache configuration used in server.cache(). The generateTimeout option is required.
     */
    cache?: ServerMethodCache | undefined;
    /**
     * a function used to generate a unique key (for caching) from the arguments passed to the method function (the flags argument is not passed as input). The server will automatically generate a
     * unique key if the function's arguments are all of types 'string', 'number', or 'boolean'. However if the method uses other types of arguments, a key generation function must be provided which
     * takes the same arguments as the function and returns a unique string (or null if no key can be generated).
     */
    generateKey?(...args: any[]): string | null;
}

/**
 * An object or an array of objects where each one contains:
 * * name - the method name.
 * * method - the method function.
 * * options - (optional) settings.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodmethods)
 */
export interface ServerMethodConfigurationObject {
    /**
     * the method name.
     */
    name: string;
    /**
     * the method function.
     */
    method: ServerMethod;
    /**
     * (optional) settings.
     */
    options?: ServerMethodOptions | undefined;
}

export type CacheProvider<T extends ClientOptions = ClientOptions> = EnginePrototype<any> | {
    constructor: EnginePrototype<any>;
    options?: T | undefined;
};

/**
 * hapi uses catbox for its cache implementation which includes support for common storage solutions (e.g. Redis,
 * MongoDB, Memcached, Riak, among others). Caching is only utilized if methods and plugins explicitly store their state in the cache.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-cache)
 */
export interface ServerOptionsCache extends PolicyOptions<any> {
    /** catbox engine object. */
    engine?: ClientApi<any> | undefined;

    /**
     * a class or a prototype function
     */
    provider?: CacheProvider | undefined;

    /**
     * an identifier used later when provisioning or configuring caching for server methods or plugins. Each cache name must be unique. A single item may omit the name option which defines
     * the default cache. If every cache includes a name, a default memory cache is provisioned as well.
     */
    name?: string | undefined;

    /** if true, allows multiple cache users to share the same segment (e.g. multiple methods using the same cache storage container). Default to false. */
    shared?: boolean | undefined;

    /** (optional) string used to isolate cached data. Defaults to 'hapi-cache'. */
    partition?: string | undefined;

    /** other options passed to the catbox strategy used. Other options are only passed to catbox when engine above is a class or function and ignored if engine is a catbox engine object). */
    [s: string]: any;
}

export interface ServerOptionsCompression {
    minBytes: number;
}

/**
 * Empty interface to allow for custom augmentation.
 */

export interface ServerOptionsApp {
}

export type SameSitePolicy = false | 'None' | 'Lax' | 'Strict';

/**
 * The server options control the behavior of the server object. Note that the options object is deeply cloned
 * (with the exception of listener which is shallowly copied) and should not contain any values that are unsafe to perform deep copy on.
 * All options are optionals.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-server-options)
 */
export interface ServerOptions {
    /**
     * @default '0.0.0.0' (all available network interfaces).
     * Sets the hostname or IP address the server will listen on. If not configured, defaults to host if present, otherwise to all available network interfaces. Set to '127.0.0.1' or 'localhost' to
     * restrict the server to only those coming from the same host.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionsaddress)
     */
    address?: string | undefined;

    /**
     * @default {}.
     * Provides application-specific configuration which can later be accessed via server.settings.app. The framework does not interact with this object. It is simply a reference made available
     * anywhere a server reference is provided. Note the difference between server.settings.app which is used to store static configuration values and server.app which is meant for storing run-time
     * state.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionsapp)
     */
    app?: ServerOptionsApp | undefined;

    /**
     * @default true.
     * Used to disable the automatic initialization of the listener. When false, indicates that the listener will be started manually outside the framework.
     * Cannot be set to true along with a port value.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionsautolisten)
     */
    autoListen?: boolean | undefined;

    /**
     * @default { engine: require('@hapi/catbox-memory' }.
     * Sets up server-side caching providers. Every server includes a default cache for storing application state. By default, a simple memory-based cache is created which has limited capacity and
     * capabilities. hapi uses catbox for its cache implementation which includes support for common storage solutions (e.g. Redis, MongoDB, Memcached, Riak, among others). Caching is only utilized
     * if methods and plugins explicitly store their state in the cache. The server cache configuration only defines the storage container itself. The configuration can be assigned one or more
     * (array):
     * * a class or prototype function (usually obtained by calling require() on a catbox strategy such as require('@hapi/catbox-redis')). A new catbox client will be created internally using this
     * function.
     * * a configuration object with the following:
     * * * engine - a class, a prototype function, or a catbox engine object.
     * * * name - an identifier used later when provisioning or configuring caching for server methods or plugins. Each cache name must be unique. A single item may omit the name option which defines
     * the default cache. If every cache includes a name, a default memory cache is provisioned as well.
     * * * shared - if true, allows multiple cache users to share the same segment (e.g. multiple methods using the same cache storage container). Default to false.
     * * * partition - (optional) string used to isolate cached data. Defaults to 'hapi-cache'.
     * * * other options passed to the catbox strategy used. Other options are only passed to catbox when engine above is a class or function and ignored if engine is a catbox engine object).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionscache)
     */
    cache?: CacheProvider | ServerOptionsCache | ServerOptionsCache[] | undefined;

    /**
     * @default { minBytes: 1024 }.
     * Defines server handling of content encoding requests. If false, response content encoding is disabled and no compression is performed by the server.
     */
    compression?: boolean | ServerOptionsCompression | undefined;

    /**
     * @default { request: ['implementation'] }.
     * Determines which logged events are sent to the console. This should only be used for development and does not affect which events are actually logged internally and recorded. Set to false to
     * disable all console logging, or to an object with:
     * * log - a string array of server log tags to be displayed via console.error() when the events are logged via server.log() as well as internally generated server logs. Defaults to no output.
     * * request - a string array of request log tags to be displayed via console.error() when the events are logged via request.log() as well as internally generated request logs. For example, to
     * display all errors, set the option to ['error']. To turn off all console debug messages set it to false. To display all request logs, set it to '*'. Defaults to uncaught errors thrown in
     * external code (these errors are handled automatically and result in an Internal Server Error response) or runtime errors due to developer error. For example, to display all errors, set the log
     * or request to ['error']. To turn off all output set the log or request to false. To display all server logs, set the log or request to '*'. To disable all debug information, set debug to
     * false.
     */
    debug?: false | {
        log?: string[] | false | undefined;
        request?: string[] | false | undefined;
    } | undefined;

    /**
     * @default the operating system hostname and if not available, to 'localhost'.
     * The public hostname or IP address. Used to set server.info.host and server.info.uri and as address is none provided.
     */
    host?: string | undefined;

    info?: {
        /**
         * @default false.
         * If true, the request.info.remoteAddress and request.info.remotePort are populated when the request is received which can consume more resource (but is ok if the information is needed,
         * especially for aborted requests). When false, the fields are only populated upon demand (but will be undefined if accessed after the request is aborted).
         */
        remote?: boolean;
    }

    /**
     * @default none.
     * An optional node HTTP (or HTTPS) http.Server object (or an object with a compatible interface).
     * If the listener needs to be manually started, set autoListen to false.
     * If the listener uses TLS, set tls to true.
     */
    listener?: http.Server | undefined;

    /**
     * @default { sampleInterval: 0 }.
     * Server excessive load handling limits where:
     * * sampleInterval - the frequency of sampling in milliseconds. When set to 0, the other load options are ignored. Defaults to 0 (no sampling).
     * * maxHeapUsedBytes - maximum V8 heap size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to 0 (no limit).
     * * maxRssBytes - maximum process RSS size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to 0 (no limit).
     * * maxEventLoopDelay - maximum event loop delay duration in milliseconds over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to 0 (no limit).
     */
    load?: {
        /** the frequency of sampling in milliseconds. When set to 0, the other load options are ignored. Defaults to 0 (no sampling). */
        sampleInterval?: number | undefined;

        /** maximum V8 heap size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to 0 (no limit). */
        maxHeapUsedBytes?: number | undefined;
        /**
         * maximum process RSS size over which incoming requests are rejected with an HTTP Server Timeout (503) response. Defaults to 0 (no limit).
         */
        maxRssBytes?: number | undefined;
        /**
         * maximum event loop delay duration in milliseconds over which incoming requests are rejected with an HTTP Server Timeout (503) response.
         * Defaults to 0 (no limit).
         */
        maxEventLoopDelay?: number | undefined;
    } | undefined;

    /**
     * @default none.
     * Options passed to the mimos module when generating the mime database used by the server (and accessed via server.mime):
     * * override - an object hash that is merged into the built in mime information specified here. Each key value pair represents a single mime object. Each override value must contain:
     * * key - the lower-cased mime-type string (e.g. 'application/javascript').
     * * value - an object following the specifications outlined here. Additional values include:
     * * * type - specify the type value of result objects, defaults to key.
     * * * predicate - method with signature function(mime) when this mime type is found in the database, this function will execute to allows customizations.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionsmime)
     */
    mime?: MimosOptions | undefined;

    /**
     * @default {}.
     * Plugin-specific configuration which can later be accessed via server.settings.plugins. plugins is an object where each key is a plugin name and the value is the configuration. Note the
     * difference between server.settings.plugins which is used to store static configuration values and server.plugins which is meant for storing run-time state.
     */
    plugins?: PluginSpecificConfiguration | undefined;

    /**
     * @default 0 (an ephemeral port).
     * The TCP port the server will listen to. Defaults the next available port when the server is started (and assigned to server.info.port).
     * If port is a string containing a '/' character, it is used as a UNIX domain socket path. If it starts with '\.\pipe', it is used as a Windows named pipe.
     */
    port?: number | string | undefined;

    /**
     * @default { isCaseSensitive: true, stripTrailingSlash: false }.
     * Controls how incoming request URIs are matched against the routing table:
     * * isCaseSensitive - determines whether the paths '/example' and '/EXAMPLE' are considered different resources. Defaults to true.
     * * stripTrailingSlash - removes trailing slashes on incoming paths. Defaults to false.
     */
    router?: {
        isCaseSensitive?: boolean | undefined;
        stripTrailingSlash?: boolean | undefined;
    } | undefined;

    /**
     * @default none.
     * A route options object used as the default configuration for every route.
     */
    routes?: RouteOptions | undefined;

    /**
     * Default value:
     * {
     *     strictHeader: true,
     *     ignoreErrors: false,
     *     isSecure: true,
     *     isHttpOnly: true,
     *     isSameSite: 'Strict',
     *     encoding: 'none'
     * }
     * Sets the default configuration for every state (cookie) set explicitly via server.state() or implicitly (without definition) using the state configuration object.
     */
    // TODO I am not sure if I need to use all the server.state() definition (like the default value) OR only the options below. The v16 use "any" here.
    // state?: ServerStateCookieOptions;
    state?: {
        strictHeader?: boolean | undefined,
        ignoreErrors?: boolean | undefined,
        isSecure?: boolean | undefined,
        isHttpOnly?: boolean | undefined,
        isSameSite?: SameSitePolicy | undefined,
        encoding?: 'none' | 'base64' | 'base64json' | 'form' | 'iron' | undefined
    };

    /**
     * @default none.
     * Used to create an HTTPS connection. The tls object is passed unchanged to the node HTTPS server as described in the node HTTPS documentation.
     */
    tls?: boolean | https.ServerOptions | undefined;

    /**
     * @default constructed from runtime server information.
     * The full public URI without the path (e.g. 'http://example.com:8080'). If present, used as the server server.info.uri, otherwise constructed from the server settings.
     */
    uri?: string | undefined;

    /**
     * Query parameter configuration.
     */
    query?: {
        /**
         * the method must return an object where each key is a parameter and matching value is the parameter value.
         * If the method throws, the error is used as the response or returned when `request.setUrl` is called.
         */
        parser(raw: Utils.Dictionary<string>): Utils.Dictionary<any>;
    } | undefined;
}

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

/**
 * An object with the following:
 * * plugin - a plugin object.
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
export interface ServerRegisterPluginObject<T> extends ServerRegisterOptions {
    /**
     * a plugin object.
     */
    plugin: Plugin<T>;
    /**
     * options passed to the plugin during registration.
     */
    options?: T | undefined;
}

export type ServerRegisterPluginObjectArray<T, U, V, W, X, Y, Z> = Array<
    ServerRegisterPluginObject<T> |
    ServerRegisterPluginObject<U> |
    ServerRegisterPluginObject<V> |
    ServerRegisterPluginObject<W> |
    ServerRegisterPluginObject<X> |
    ServerRegisterPluginObject<Y> |
    ServerRegisterPluginObject<Z>
>;

export interface HandlerDecorations {}

export interface RouteRules {}

export interface RulesInfo {
    method: string;
    path: string;
    vhost: string;
}

export interface RulesOptions<Refs extends ReqRef = ReqRefDefaults> {
    validate: {
        schema?: ObjectSchema<MergeRefs<Refs>['Rules']> | Record<keyof MergeRefs<Refs>['Rules'], Schema>;
        options?: ValidationOptions;
    };
}

export interface RulesProcessor<Refs extends ReqRef = ReqRefDefaults> {
    (rules: MergeRefs<Refs>['Rules'] | null, info: RulesInfo): Partial<RouteOptions<Refs>> | null;
}

/**
 * A route configuration object or an array of configuration objects where each object contains:
 * * path - (required) the absolute path used to match incoming requests (must begin with '/'). Incoming requests are compared to the configured paths based on the server's router configuration. The
 * path can include named parameters enclosed in {} which will be matched against literal values in the request as described in Path parameters.
 * * method - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', or 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'. Use '*' to match against any HTTP
 * method (only when an exact match was not found, and any match with a specific method will be given a higher priority over a wildcard match). Can be assigned an array of methods which has the same
 * result as adding the same route with different methods manually.
 * * vhost - (optional) a domain string or an array of domain strings for limiting the route to only requests with a matching host header field. Matching is done against the hostname part of the
 * header only (excluding the port). Defaults to all hosts.
 * * handler - (required when handler is not set) the route handler function called to generate the response after successful authentication and validation.
 * * options - additional route options. The options value can be an object or a function that returns an object using the signature function(server) where server is the server the route is being
 * added to and this is bound to the current realm's bind option.
 * * rules - route custom rules object. The object is passed to each rules processor registered with server.rules(). Cannot be used if route.options.rules is defined.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverrouteroute)
 */
export interface ServerRoute<Refs extends ReqRef = ReqRefDefaults> {
    /**
     * (required) the absolute path used to match incoming requests (must begin with '/'). Incoming requests are compared to the configured paths based on the server's router configuration. The path
     * can include named parameters enclosed in {} which will be matched against literal values in the request as described in Path parameters. For context [See
     * docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverrouteroute) For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#path-parameters)
     */
    path: string;

    /**
     * (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', or 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'. Use '*' to match against any HTTP method
     * (only when an exact match was not found, and any match with a specific method will be given a higher priority over a wildcard match). Can be assigned an array of methods which has the same
     * result as adding the same route with different methods manually.
     */
    method: Utils.HTTP_METHODS_PARTIAL | Utils.HTTP_METHODS_PARTIAL[] | string | string[];

    /**
     * (optional) a domain string or an array of domain strings for limiting the route to only requests with a matching host header field. Matching is done against the hostname part of the header
     * only (excluding the port). Defaults to all hosts.
     */
    vhost?: string | string[] | undefined;

    /**
     * (required when handler is not set) the route handler function called to generate the response after successful authentication and validation.
     */
    handler?: Lifecycle.Method<Refs> | HandlerDecorations | undefined;

    /**
     * additional route options. The options value can be an object or a function that returns an object using the signature function(server) where server is the server the route is being added to
     * and this is bound to the current realm's bind option.
     */
    options?: RouteOptions<Refs> | ((server: Server) => RouteOptions<Refs>) | undefined;

    /**
     * route custom rules object. The object is passed to each rules processor registered with server.rules(). Cannot be used if route.options.rules is defined.
     */
    rules?: Refs['Rules'] | undefined;
}

/**
 * Optional cookie settings
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverstatename-options)
 */
export interface ServerStateCookieOptions {
    /** time-to-live in milliseconds. Defaults to null (session time-life - cookies are deleted when the browser is closed). */
    ttl?: number | null | undefined;
    /** sets the 'Secure' flag. Defaults to true. */
    isSecure?: boolean | undefined;
    /** sets the 'HttpOnly' flag. Defaults to true. */
    isHttpOnly?: boolean | undefined;
    /**
     * sets the 'SameSite' flag. The value must be one of:
     *  * false - no flag.
     *  * 'Strict' - sets the value to 'Strict' (this is the default value).
     *  * 'Lax' - sets the value to 'Lax'.
     */
    isSameSite?: SameSitePolicy | undefined;
    /** the path scope. Defaults to null (no path). */
    path?: string | null | undefined;
    /** the domain scope. Defaults to null (no domain). */
    domain?: string | null | undefined;

    /**
     * if present and the cookie was not received from the client or explicitly set by the route handler, the
     * cookie is automatically added to the response with the provided value. The value can be
     * a function with signature async function(request) where:
     */
    autoValue?(request: Request): void;

    /**
     * encoding performs on the provided value before serialization. Options are:
     *  * 'none' - no encoding. When used, the cookie value must be a string. This is the default value.
     *  * 'base64' - string value is encoded using Base64.
     *  * 'base64json' - object value is JSON-stringified then encoded using Base64.
     *  * 'form' - object value is encoded using the x-www-form-urlencoded method.
     *  * 'iron' - Encrypts and sign the value using iron.
     */
    encoding?: 'none' | 'base64' | 'base64json' | 'form' | 'iron' | undefined;
    /**
     * an object used to calculate an HMAC for cookie integrity validation. This does not provide privacy, only a mean
     * to verify that the cookie value was generated by the server. Redundant when 'iron' encoding is used. Options are:
     *  * integrity - algorithm options. Defaults to require('@hapi/iron').defaults.integrity.
     *  * password - password used for HMAC key generation (must be at least 32 characters long).
     */
    sign?: {
        integrity?: SealOptionsSub | undefined;
        password: string;
    } | undefined;
    /** password used for 'iron' encoding (must be at least 32 characters long). */
    password?: string | undefined;
    /** options for 'iron' encoding. Defaults to require('@hapi/iron').defaults. */
    iron?: SealOptions | undefined;
    /** if true, errors are ignored and treated as missing cookies. */
    ignoreErrors?: boolean | undefined;
    /** if true, automatically instruct the client to remove invalid cookies. Defaults to false. */
    clearInvalid?: boolean | undefined;
    /** if false, allows any cookie value including values in violation of RFC 6265. Defaults to true. */
    strictHeader?: boolean | undefined;
    /** used by proxy plugins (e.g. h2o2). */
    passThrough?: any;
}

/**
 * A single object or an array of object where each contains:
 * * name - the cookie name.
 * * value - the cookie value.
 * * options - cookie configuration to override the server settings.
 */
export interface ServerStateFormat {
    name: string;
    value: string;
    options: ServerStateCookieOptions;
}

/**
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverstatename-options)
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptionsstate)
 */
export interface ServerState {
    /**
     * The server cookies manager.
     * Access: read only and statehood public interface.
     */
    readonly states: object;

    /**
     * The server cookies manager settings. The settings are based on the values configured in [server.options.state](https://github.com/hapijs/hapi/blob/master/API.md#server.options.state).
     */
    readonly settings: ServerStateCookieOptions;

    /**
     * An object containing the configuration of each cookie added via [server.state()](https://github.com/hapijs/hapi/blob/master/API.md#server.state()) where each key is the
     * cookie name and value is the configuration object.
     */
    readonly cookies: {
        [key: string]: ServerStateCookieOptions;
    };

    /**
     * An array containing the names of all configured cookies.
     */
    readonly names: string[];

    /**
     * Same as calling [server.state()](https://github.com/hapijs/hapi/blob/master/API.md#server.state()).
     */
    add(name: string, options?: ServerStateCookieOptions): void;

    /**
     * Formats an HTTP 'Set-Cookie' header based on the server.options.state where:
     * @param cookies - a single object or an array of object where each contains:
     * * name - the cookie name.
     * * value - the cookie value.
     * * options - cookie configuration to override the server settings.
     * @return Return value: a header string.
     * Note that this utility uses the server configuration but does not change the server state. It is provided for manual cookie formatting (e.g. when headers are set manually).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-async-serverstatesformatcookies)
     */
    format(cookies: ServerStateFormat | ServerStateFormat[]): Promise<string>;

    /**
     * Parses an HTTP 'Cookies' header based on the server.options.state where:
     * @param header - the HTTP header.
     * @return Return value: an object where each key is a cookie name and value is the parsed cookie.
     * Note that this utility uses the server configuration but does not change the server state. It is provided for manual cookie parsing (e.g. when server parsing is disabled).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-async-serverstatesparseheader)
     */
    parse(header: string): Promise<Utils.Dictionary<string>>;
}

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

/**
 * An empty interface to allow typings of custom server.methods.
 */
export interface ServerMethods extends Utils.Dictionary<ServerMethod> {
}

export type DecorateName = string | symbol;

/**
 * The server object is the main application container. The server manages all incoming requests along with all
 * the facilities provided by the framework. Each server supports a single connection (e.g. listen to port 80).
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#server)
 */
export class Server {
    /**
     * Creates a new server object
     * @param options server configuration object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serveroptions)
     */
    constructor(options?: ServerOptions);

    /**
     * Provides a safe place to store server-specific run-time application data without potential conflicts with
     * the framework internals. The data can be accessed whenever the server is accessible.
     * Initialized with an empty object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverapp)
     */
    app: ServerApplicationState;

    /**
     * Server Auth: properties and methods
     */
    readonly auth: ServerAuth;

    /**
     * Links another server to the initialize/start/stop state of the current server by calling the
     * controlled server `initialize()`/`start()`/`stop()` methods whenever the current server methods
     * are called, where:
     */
    control(server: Server): void;

    /**
     * Provides access to the decorations already applied to various framework interfaces. The object must not be
     * modified directly, but only through server.decorate.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverdecorations)
     */
    readonly decorations: {
        /**
         * decorations on the request object.
         */
        request: string[],
        /**
         * decorations on the response toolkit.
         */
        toolkit: string[],
        /**
         * decorations on the server object.
         */
        server: string[]
    };

    /**
     * Register custom application events where:
     * @param events must be one of:
     * * an event name string.
     * * an event options object with the following optional keys (unless noted otherwise):
     * * * name - the event name string (required).
     * * * channels - a string or array of strings specifying the event channels available. Defaults to no channel restrictions (event updates can specify a channel or not).
     * * * clone - if true, the data object passed to server.events.emit() is cloned before it is passed to the listeners (unless an override specified by each listener). Defaults to false (data is
     *     passed as-is).
     * * * spread - if true, the data object passed to server.event.emit() must be an array and the listener method is called with each array element passed as a separate argument (unless an override
     *     specified by each listener). This should only be used when the emitted data structure is known and predictable. Defaults to false (data is emitted as a single argument regardless of its
     *     type).
     * * * tags - if true and the criteria object passed to server.event.emit() includes tags, the tags are mapped to an object (where each tag string is the key and the value is true) which is
     *     appended to the arguments list at the end. A configuration override can be set by each listener. Defaults to false.
     * * * shared - if true, the same event name can be registered multiple times where the second registration is ignored. Note that if the registration config is changed between registrations, only
     *     the first configuration is used. Defaults to false (a duplicate registration will throw an error).
     * * a podium emitter object.
     * * an array containing any of the above.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
     */
    event(events: ServerEventsApplication | ServerEventsApplication[]): void;

    /**
     * Access: podium public interface.
     * The server events emitter. Utilizes the podium with support for event criteria validation, channels, and filters.
     * Use the following methods to interact with server.events:
     * [server.events.emit(criteria, data)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.emit()) - emit server events.
     * [server.events.on(criteria, listener)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.on()) - subscribe to all events.
     * [server.events.once(criteria, listener)](https://github.com/hapijs/hapi/blob/master/API.md#server.events.once()) - subscribe to
     * Other methods include: server.events.removeListener(name, listener), server.events.removeAllListeners(name), and server.events.hasListeners(name).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverevents)
     */
    events: ServerEvents;

    /**
     * An object containing information about the server where:
     * * id - a unique server identifier (using the format '{hostname}:{pid}:{now base36}').
     * * created - server creation timestamp.
     * * started - server start timestamp (0 when stopped).
     * * port - the connection port based on the following rules:
     * * host - The host configuration value.
     * * address - the active IP address the connection was bound to after starting. Set to undefined until the server has been started or when using a non TCP port (e.g. UNIX domain socket).
     * * protocol - the protocol used:
     * * 'http' - HTTP.
     * * 'https' - HTTPS.
     * * 'socket' - UNIX domain socket or Windows named pipe.
     * * uri - a string representing the connection (e.g. 'http://example.com:8080' or 'socket:/unix/domain/socket/path'). Contains the uri value if set, otherwise constructed from the available
     * settings. If no port is configured or is set to 0, the uri will not include a port component until the server is started.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverinfo)
     */
    readonly info: ServerInfo;

    /**
     * Access: read only and listener public interface.
     * The node HTTP server object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverlistener)
     */
    listener: http.Server;

    /**
     * An object containing the process load metrics (when load.sampleInterval is enabled):
     * * eventLoopDelay - event loop delay milliseconds.
     * * heapUsed - V8 heap usage.
     * * rss - RSS memory usage.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverload)
     */
    readonly load: {
        /**
         * event loop delay milliseconds.
         */
        eventLoopDelay: number;

        /**
         * V8 heap usage.
         */
        heapUsed: number;
        /**
         * RSS memory usage.
         */
        rss: number;
    };

    /**
     * Server methods are functions registered with the server and used throughout the application as a common utility.
     * Their advantage is in the ability to configure them to use the built-in cache and share across multiple request
     * handlers without having to create a common module.
     * sever.methods is an object which provides access to the methods registered via server.method() where each
     * server method name is an object property.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethods
     */
    readonly methods: ServerMethods;

    /**
     * Provides access to the server MIME database used for setting content-type information. The object must not be
     * modified directly but only through the [mime](https://github.com/hapijs/hapi/blob/master/API.md#server.options.mime) server setting.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermime)
     */
    mime: any;

    /**
     * An object containing the values exposed by each registered plugin where each key is a plugin name and the values
     * are the exposed properties by each plugin using server.expose(). Plugins may set the value of
     * the server.plugins[name] object directly or via the server.expose() method.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverplugins)
     */
    plugins: PluginProperties;

    /**
     * The realm object contains sandboxed server settings specific to each plugin or authentication strategy. When
     * registering a plugin or an authentication scheme, a server object reference is provided with a new server.realm
     * container specific to that registration. It allows each plugin to maintain its own settings without leaking
     * and affecting other plugins.
     * For example, a plugin can set a default file path for local resources without breaking other plugins' configured
     * paths. When calling server.bind(), the active realm's settings.bind property is set which is then used by
     * routes and extensions added at the same level (server root or plugin).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverrealm)
     */
    readonly realm: ServerRealm;

    /**
     * An object of the currently registered plugins where each key is a registered plugin name and the value is
     * an object containing:
     * * version - the plugin version.
     * * name - the plugin name.
     * * options - (optional) options passed to the plugin during registration.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverregistrations)
     */
    readonly registrations: PluginsListRegistered;

    /**
     * The server configuration object after defaults applied.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serversettings)
     */
    readonly settings: ServerOptions;

    /**
     * The server cookies manager.
     * Access: read only and statehood public interface.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverstates)
     */
    readonly states: ServerState;

    /**
     * A string indicating the listener type where:
     * * 'socket' - UNIX domain socket or Windows named pipe.
     * * 'tcp' - an HTTP listener.
     */
    readonly type: 'socket' | 'tcp';

    /**
     * The hapi module version number.
     */
    readonly version: string;

    /**
     * Sets a global context used as the default bind object when adding a route or an extension where:
     * @param context - the object used to bind this in lifecycle methods such as the route handler and extension methods. The context is also made available as h.context.
     * @return Return value: none.
     * When setting a context inside a plugin, the context is applied only to methods set up by the plugin. Note that the context applies only to routes and extensions added after it has been set.
     *     Ignored if the method being bound is an arrow function.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverbindcontext)
     */
    bind(context: object): void;

    /**
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servercacheoptions)
     */
    cache: ServerCache;

    /**
     * Registers a custom content decoding compressor to extend the built-in support for 'gzip' and 'deflate' where:
     * @param encoding - the decoder name string.
     * @param decoder - a function using the signature function(options) where options are the encoding specific options configured in the route payload.compression configuration option, and the
     *     return value is an object compatible with the output of node's zlib.createGunzip().
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverdecoderencoding-decoder)
     */
    decoder(encoding: string, decoder: ((options: PayloadCompressionDecoderSettings) => zlib.Gunzip)): void;

    /**
     * Extends various framework interfaces with custom methods where:
     * @param type - the interface being decorated. Supported types:
     * 'handler' - adds a new handler type to be used in routes handlers.
     * 'request' - adds methods to the Request object.
     * 'server' - adds methods to the Server object.
     * 'toolkit' - adds methods to the response toolkit.
     * @param property - the object decoration key name.
     * @param method - the extension function or other value.
     * @param options - (optional) supports the following optional settings:
     * apply - when the type is 'request', if true, the method function is invoked using the signature function(request) where request is the current request object and the returned value is assigned
     *     as the decoration. extend - if true, overrides an existing decoration. The method must be a function with the signature function(existing) where: existing - is the previously set
     *     decoration method value. must return the new decoration function or value. cannot be used to extend handler decorations.
     * @return void;
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverdecoratetype-property-method-options)
     */
    decorate(type: 'handler', property: DecorateName, method: HandlerDecorationMethod, options?: {apply?: boolean | undefined, extend?: boolean | undefined}): void;
    decorate(type: 'request', property: DecorateName, method: (existing: ((...args: any[]) => any)) => (request: Request) => DecorationMethod<Request>, options: {apply: true, extend: true}): void;
    decorate(type: 'request', property: DecorateName, method: (request: Request) => DecorationMethod<Request>, options: {apply: true, extend?: boolean | undefined}): void;
    decorate(type: 'request', property: DecorateName, method: DecorationMethod<Request>, options?: {apply?: boolean | undefined, extend?: boolean | undefined}): void;
    decorate(type: 'toolkit', property: DecorateName, method: (existing: ((...args: any[]) => any)) => DecorationMethod<ResponseToolkit>, options: {apply?: boolean | undefined, extend: true}): void;
    decorate(type: 'toolkit', property: DecorateName, method: DecorationMethod<ResponseToolkit>, options?: {apply?: boolean | undefined, extend?: boolean | undefined}): void;
    decorate(type: 'server', property: DecorateName, method: (existing: ((...args: any[]) => any)) => DecorationMethod<Server>, options: {apply?: boolean | undefined, extend: true}): void;
    decorate(type: 'server', property: DecorateName, method: DecorationMethod<Server>, options?: {apply?: boolean | undefined, extend?: boolean | undefined}): void;

    /**
     * Used within a plugin to declare a required dependency on other plugins where:
     * @param dependencies - plugins which must be registered in order for this plugin to operate. Plugins listed must be registered before the server is
     *     initialized or started.
     * @param after - (optional) a function that is called after all the specified dependencies have been registered and before the server starts. The function is only called if the server is
     *     initialized or started. The function signature is async function(server) where: server - the server the dependency() method was called on.
     * @return Return value: none.
     * The after method is identical to setting a server extension point on 'onPreStart'.
     * If a circular dependency is detected, an exception is thrown (e.g. two plugins each has an after function to be called after the other).
     * The method does not provide version dependency which should be implemented using npm peer dependencies.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverdependencydependencies-after)
     */
    dependency(dependencies: Dependencies, after?: ((server: Server) => Promise<void>)): void;

    /**
     * Registers a custom content encoding compressor to extend the built-in support for 'gzip' and 'deflate' where:
     * @param encoding - the encoder name string.
     * @param encoder - a function using the signature function(options) where options are the encoding specific options configured in the route compression option, and the return value is an object
     *     compatible with the output of node's zlib.createGzip().
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverencoderencoding-encoder)
     */
    encoder(encoding: string, encoder: ((options: RouteCompressionEncoderSettings) => zlib.Gzip)): void;

    /**
     * Used within a plugin to expose a property via server.plugins[name] where:
     * @param key - the key assigned (server.plugins[name][key]).
     * @param value - the value assigned.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverexposekey-value)
     */
    expose(key: string, value: any): void;

    /**
     * Merges an object into to the existing content of server.plugins[name] where:
     * @param obj - the object merged into the exposed properties container.
     * @return Return value: none.
     * Note that all the properties of obj are deeply cloned into server.plugins[name], so avoid using this method
     * for exposing large objects that may be expensive to clone or singleton objects such as database client
     * objects. Instead favor server.expose(key, value), which only copies a reference to value.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverexposeobj)
     */
    expose(obj: object): void;

    /**
     * Registers an extension function in one of the request lifecycle extension points where:
     * @param events - an object or array of objects with the following:
     * * type - (required) the extension point event name. The available extension points include the request extension points as well as the following server extension points:
     * * * 'onPreStart' - called before the connection listeners are started.
     * * * 'onPostStart' - called after the connection listeners are started.
     * * * 'onPreStop' - called before the connection listeners are stopped.
     * * * 'onPostStop' - called after the connection listeners are stopped.
     * * method - (required) a function or an array of functions to be executed at a specified point during request processing. The required extension function signature is:
     * * * server extension points: async function(server) where:
     * * * * server - the server object.
     * * * * this - the object provided via options.bind or the current active context set with server.bind().
     * * * request extension points: a lifecycle method.
     * * options - (optional) an object with the following:
     * * * before - a string or array of strings of plugin names this method must execute before (on the same event). Otherwise, extension methods are executed in the order added.
     * * * after - a string or array of strings of plugin names this method must execute after (on the same event). Otherwise, extension methods are executed in the order added.
     * * * bind - a context object passed back to the provided method (via this) when called. Ignored if the method is an arrow function.
     * * * sandbox - if set to 'plugin' when adding a request extension points the extension is only added to routes defined by the current plugin. Not allowed when configuring route-level
     *     extensions, or when adding server extensions. Defaults to 'server' which applies to any route added to the server the extension is added to.
     * @return void
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevents)
     */
    ext(events: ServerExtEventsObject | ServerExtEventsObject[] | ServerExtEventsRequestObject | ServerExtEventsRequestObject[]): void;

    /**
     * Registers a single extension event using the same properties as used in server.ext(events), but passed as arguments.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverextevent-method-options)
     */
    ext(event: ServerExtType, method: ServerExtPointFunction, options?: ServerExtOptions): void;
    ext(event: ServerRequestExtType, method: Lifecycle.Method, options?: ServerExtOptions): void;

    /**
     * Initializes the server (starts the caches, finalizes plugin registration) but does not start listening on the connection port.
     * @return Return value: none.
     * Note that if the method fails and throws an error, the server is considered to be in an undefined state and
     * should be shut down. In most cases it would be impossible to fully recover as the various plugins, caches, and
     * other event listeners will get confused by repeated attempts to start the server or make assumptions about the
     * healthy state of the environment. It is recommended to abort the process when the server fails to start properly.
     * If you must try to resume after an error, call server.stop() first to reset the server state.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverinitialize)
     */
    initialize(): Promise<void>;

    /**
     * Injects a request into the server simulating an incoming HTTP request without making an actual socket connection. Injection is useful for testing purposes as well as for invoking routing logic
     * internally without the overhead and limitations of the network stack. The method utilizes the shot module for performing injections, with some additional options and response properties:
     * @param options - can be assigned a string with the requested URI, or an object with:
     * * method - (optional) the request HTTP method (e.g. 'POST'). Defaults to 'GET'.
     * * url - (required) the request URL. If the URI includes an authority (e.g. 'example.com:8080'), it is used to automatically set an HTTP 'Host' header, unless one was specified in headers.
     * * headers - (optional) an object with optional request headers where each key is the header name and the value is the header content. Defaults to no additions to the default shot headers.
     * * payload - (optional) an string, buffer or object containing the request payload. In case of an object it will be converted to a string for you. Defaults to no payload. Note that payload
     *     processing defaults to 'application/json' if no 'Content-Type' header provided.
     * * credentials - (optional) an credentials object containing authentication information. The credentials are used to bypass the default authentication strategies, and are validated directly as
     *     if they were received via an authentication scheme. Defaults to no credentials.
     * * artifacts - (optional) an artifacts object containing authentication artifact information. The artifacts are used to bypass the default authentication strategies, and are validated directly
     *     as if they were received via an authentication scheme. Ignored if set without credentials. Defaults to no artifacts.
     * * app - (optional) sets the initial value of request.app, defaults to {}.
     * * plugins - (optional) sets the initial value of request.plugins, defaults to {}.
     * * allowInternals - (optional) allows access to routes with config.isInternal set to true. Defaults to false.
     * * remoteAddress - (optional) sets the remote address for the incoming connection.
     * * simulate - (optional) an object with options used to simulate client request stream conditions for testing:
     * * error - if true, emits an 'error' event after payload transmission (if any). Defaults to false.
     * * close - if true, emits a 'close' event after payload transmission (if any). Defaults to false.
     * * end - if false, does not end the stream. Defaults to true.
     * * split - indicates whether the request payload will be split into chunks. Defaults to undefined, meaning payload will not be chunked.
     * * validate - (optional) if false, the options inputs are not validated. This is recommended for run-time usage of inject() to make it perform faster where input validation can be tested
     *     separately.
     * @return Return value: a response object with the following properties:
     * * statusCode - the HTTP status code.
     * * headers - an object containing the headers set.
     * * payload - the response payload string.
     * * rawPayload - the raw response payload buffer.
     * * raw - an object with the injection request and response objects:
     * * req - the simulated node request object.
     * * res - the simulated node response object.
     * * result - the raw handler response (e.g. when not a stream or a view) before it is serialized for transmission. If not available, the value is set to payload. Useful for inspection and reuse
     *     of the internal objects returned (instead of parsing the response string).
     * * request - the request object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverinjectoptions)
     */
    // tslint:disable-next-line no-unnecessary-generics
    inject <Result = object>(options: string | ServerInjectOptions): Promise<ServerInjectResponse<Result>>;

    /**
     * Logs server events that cannot be associated with a specific request. When called the server emits a 'log' event which can be used by other listeners or plugins to record the information or
     * output to the console. The arguments are:
     * @param tags - (required) a string or an array of strings (e.g. ['error', 'database', 'read']) used to identify the event. Tags are used instead of log levels and provide a much more expressive
     *     mechanism for describing and filtering events. Any logs generated by the server internally include the 'hapi' tag along with event-specific information.
     * @param data - (optional) an message string or object with the application data being logged. If data is a function, the function signature is function() and it called once to generate (return
     *     value) the actual data emitted to the listeners. If no listeners match the event, the data function is not invoked.
     * @param timestamp - (optional) an timestamp expressed in milliseconds. Defaults to Date.now() (now).
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverlogtags-data-timestamp)
     */
    log(tags: string | string[], data?: string | object | (() => any), timestamp?: number): void;

    /**
     * Looks up a route configuration where:
     * @param id - the route identifier.
     * @return Return value: the route information if found, otherwise null.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverlookupid)
     */
    lookup(id: string): RequestRoute | null;

    /**
     * Looks up a route configuration where:
     * @param method - the HTTP method (e.g. 'GET', 'POST').
     * @param path - the requested path (must begin with '/').
     * @param host - (optional) hostname (to match against routes with vhost).
     * @return Return value: the route information if found, otherwise null.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermatchmethod-path-host)
     */
    match(method: Utils.HTTP_METHODS, path: string, host?: string): RequestRoute | null;

    /**
     * Registers a server method where:
     * @param name - a unique method name used to invoke the method via server.methods[name].
     * @param method - the method function with a signature async function(...args, [flags]) where:
     * * ...args - the method function arguments (can be any number of arguments or none).
     * * flags - when caching is enabled, an object used to set optional method result flags:
     * * * ttl - 0 if result is valid but cannot be cached. Defaults to cache policy.
     * @param options - (optional) configuration object:
     * * bind - a context object passed back to the method function (via this) when called. Defaults to active context (set via server.bind() when the method is registered. Ignored if the method is
     *     an arrow function.
     * * cache - the same cache configuration used in server.cache(). The generateTimeout option is required.
     * * generateKey - a function used to generate a unique key (for caching) from the arguments passed to the method function (the flags argument is not passed as input). The server will
     *     automatically generate a unique key if the function's arguments are all of types 'string', 'number', or 'boolean'. However if the method uses other types of arguments, a key generation
     *     function must be provided which takes the same arguments as the function and returns a unique string (or null if no key can be generated).
     * @return Return value: none.
     * Method names can be nested (e.g. utils.users.get) which will automatically create the full path under server.methods (e.g. accessed via server.methods.utils.users.get).
     * When configured with caching enabled, server.methods[name].cache is assigned an object with the following properties and methods: - await drop(...args) - a function that can be used to clear
     *     the cache for a given key. - stats - an object with cache statistics, see catbox for stats documentation.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
     */
    method(name: string, method: ServerMethod, options?: ServerMethodOptions): void;

    /**
     * Registers a server method function as described in server.method() using a configuration object where:
     * @param methods - an object or an array of objects where each one contains:
     * * name - the method name.
     * * method - the method function.
     * * options - (optional) settings.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodmethods)
     */
    method(methods: ServerMethodConfigurationObject | ServerMethodConfigurationObject[]): void;

    /**
     * Sets the path prefix used to locate static resources (files and view templates) when relative paths are used where:
     * @param relativeTo - the path prefix added to any relative file path starting with '.'.
     * @return Return value: none.
     * Note that setting a path within a plugin only applies to resources accessed by plugin methods. If no path is set, the server default route configuration files.relativeTo settings is used. The
     *     path only applies to routes added after it has been set.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverpathrelativeto)
     */
    path(relativeTo: string): void;

    /**
     * Registers a plugin where:
     * @param plugins - one or an array of:
     * * a plugin object.
     * * an object with the following:
     * * * plugin - a plugin object.
     * * * options - (optional) options passed to the plugin during registration.
     * * * once, routes - (optional) plugin-specific registration options as defined below.
     * @param options - (optional) registration options (different from the options passed to the registration function):
     * * once - if true, subsequent registrations of the same plugin are skipped without error. Cannot be used with plugin options. Defaults to false. If not set to true, an error will be thrown the
     *     second time a plugin is registered on the server.
     * * routes - modifiers applied to each route added by the plugin:
     * * * prefix - string added as prefix to any route path (must begin with '/'). If a plugin registers a child plugin the prefix is passed on to the child or is added in front of the
     *     child-specific prefix.
     * * * vhost - virtual host string (or array of strings) applied to every route. The outer-most vhost overrides the any nested configuration.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverregisterplugins-options)
     */
     /* tslint:disable-next-line:no-unnecessary-generics */
    register<T>(plugin: ServerRegisterPluginObject<T>, options?: ServerRegisterOptions): Promise<void>;
    /* tslint:disable-next-line:no-unnecessary-generics */
    register<T, U, V, W, X, Y, Z>(plugins: ServerRegisterPluginObjectArray<T, U, V, W, X, Y, Z>, options?: ServerRegisterOptions): Promise<void>;
    register(plugins: Array<ServerRegisterPluginObject<any>>, options?: ServerRegisterOptions): Promise<void>;
    /* tslint:disable-next-line:unified-signatures */
    register(plugins: Plugin<any> | Array<Plugin<any>>, options?: ServerRegisterOptions): Promise<void>;

    /**
     * Adds a route where:
     * @param route - a route configuration object or an array of configuration objects where each object contains:
     * * path - (required) the absolute path used to match incoming requests (must begin with '/'). Incoming requests are compared to the configured paths based on the server's router configuration.
     *     The path can include named parameters enclosed in {} which will be matched against literal values in the request as described in Path parameters.
     * * method - (required) the HTTP method. Typically one of 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', or 'OPTIONS'. Any HTTP method is allowed, except for 'HEAD'. Use '*' to match against any HTTP
     *     method (only when an exact match was not found, and any match with a specific method will be given a higher priority over a wildcard match). Can be assigned an array of methods which has
     *     the same result as adding the same route with different methods manually.
     * * vhost - (optional) a domain string or an array of domain strings for limiting the route to only requests with a matching host header field. Matching is done against the hostname part of the
     *     header only (excluding the port). Defaults to all hosts.
     * * handler - (required when handler is not set) the route handler function called to generate the response after successful authentication and validation.
     * * options - additional route options. The options value can be an object or a function that returns an object using the signature function(server) where server is the server the route is being
     *     added to and this is bound to the current realm's bind option.
     * * rules - route custom rules object. The object is passed to each rules processor registered with server.rules(). Cannot be used if route.options.rules is defined.
     * @return Return value: none.
     * Note that the options object is deeply cloned (with the exception of bind which is shallowly copied) and cannot contain any values that are unsafe to perform deep copy on.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverrouteroute)
     */

    // tslint:disable-next-line:no-unnecessary-generics
    route <Refs extends ReqRef = ReqRefDefaults>(route: ServerRoute<Refs> | Array<ServerRoute<Refs>>): void;

    /**
     * Defines a route rules processor for converting route rules object into route configuration where:
     * @param processor - a function using the signature function(rules, info) where:
     * * rules -
     * * info - an object with the following properties:
     * * * method - the route method.
     * * * path - the route path.
     * * * vhost - the route virtual host (if any defined).
     * * returns a route config object.
     * @param options - optional settings:
     * * validate - rules object validation:
     * * * schema - joi schema.
     * * * options - optional joi validation options. Defaults to { allowUnknown: true }.
     * Note that the root server and each plugin server instance can only register one rules processor. If a route is added after the rules are configured, it will not include the rules config.
     *     Routes added by plugins apply the rules to each of the parent realms' rules from the root to the route's realm. This means the processor defined by the plugin override the config generated
     *     by the root processor if they overlap. The route config overrides the rules config if the overlap.
     * @return void
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverrulesprocessor-options)
     */
    rules <Refs extends ReqRef = ReqRefDefaults>(
        processor: RulesProcessor<Refs>,
        options?: RulesOptions<Refs>
    ): void;

    /**
     * Starts the server by listening for incoming requests on the configured port (unless the connection was configured with autoListen set to false).
     * @return Return value: none.
     * Note that if the method fails and throws an error, the server is considered to be in an undefined state and should be shut down. In most cases it would be impossible to fully recover as the
     *     various plugins, caches, and other event listeners will get confused by repeated attempts to start the server or make assumptions about the healthy state of the environment. It is
     *     recommended to abort the process when the server fails to start properly. If you must try to resume after an error, call server.stop() first to reset the server state. If a started server
     *     is started again, the second call to server.start() is ignored. No events will be emitted and no extension points invoked.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverstart)
     */
    start(): Promise<void>;

    /**
     * HTTP state management uses client cookies to persist a state across multiple requests.
     * @param name - the cookie name string.
     * @param options - are the optional cookie settings
     * @return Return value: none.
     * State defaults can be modified via the server default state configuration option.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverstatename-options)
     */
    state(name: string, options?: ServerStateCookieOptions): void;

    /**
     * Stops the server's listener by refusing to accept any new connections or requests (existing connections will continue until closed or timeout), where:
     * @param options - (optional) object with:
     * * timeout - overrides the timeout in millisecond before forcefully terminating a connection. Defaults to 5000 (5 seconds).
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-await-serverstopoptions)
     */
    stop(options?: {timeout: number}): Promise<void>;

    /**
     * Returns a copy of the routing table where:
     * @param host - (optional) host to filter routes matching a specific virtual host. Defaults to all virtual hosts.
     * @return Return value: an array of routes where each route contains:
     * * settings - the route config with defaults applied.
     * * method - the HTTP method in lower case.
     * * path - the route path.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servertablehost)
     */
    table(host?: string): RequestRoute[];

    /**
     * Registers a server validation module used to compile raw validation rules into validation schemas for all routes.
     * The validator is only used when validation rules are not pre-compiled schemas. When a validation rules is a function or schema object, the rule is used as-is and the validator is not used.
     */
    validator(joi: Root): void;
}

/**
 * Factory function to create a new server object (introduced in v17).
 */
export function server(opts?: ServerOptions): Server;
