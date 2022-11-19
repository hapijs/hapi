import { Server } from './server';
import {
    MergeType,
    ReqRef,
    ReqRefDefaults,
    MergeRefs,
    Request,
    RequestAuth} from '../request';
import { ResponseToolkit, AuthenticationData } from '../response';
import { RouteOptionsAccess, InternalRouteOptionType, RouteOptionTypes} from '../route';
import { Lifecycle } from '../utils';

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
    api: Record<string, ServerAuthSchemeObjectApi>;

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
