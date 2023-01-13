
import { ObjectSchema, ValidationOptions, SchemaMap, Schema } from 'joi';

import { PluginSpecificConfiguration} from './plugin';
import { MergeType, ReqRef, ReqRefDefaults, MergeRefs, AuthMode } from './request';
import { RouteRequestExtType, RouteExtObject, Server } from './server';
import { Lifecycle, Json, HTTP_METHODS_PARTIAL } from './utils';

/**
 * Overrides for `InternalRouteOptionType`. Extend this to have
 * typings for route.options.auth['strategy' || 'scope']
 *
 * @example
 *
 * interface RoutOptionTypes {
 *      Strategy: 'jwt' | 'basic' | 'myCustom'
 *      Scope: 'user' | 'admin' | 'manager-users'
 * }
 */
export interface RouteOptionTypes {
}

export interface InternalRouteOptionType {
    Strategy: string;
    Scope: RouteOptionsAccessScope;
}

export type RouteOptionsAccessScope = false | string | string[];

export type AccessEntity = 'any' | 'user' | 'app';

export interface RouteOptionsAccessScopeObject {
    scope: RouteOptionsAccessScope;
}

export interface RouteOptionsAccessEntityObject {
    entity: AccessEntity;
}

export type RouteOptionsAccessObject =
    RouteOptionsAccessScopeObject
    | RouteOptionsAccessEntityObject
    | (RouteOptionsAccessScopeObject & RouteOptionsAccessEntityObject);

/**
 * Route Authentication Options
 */
export interface RouteOptionsAccess {
    /**
     * @default none.
     * An object or array of objects specifying the route access rules. Each rule is evaluated against an incoming request and access is granted if at least one of the rules matches. Each rule object
     * must include at least one of scope or entity.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthaccess)
     */
    access?: RouteOptionsAccessObject | RouteOptionsAccessObject[] | undefined;

    /**
     * @default false (no scope requirements).
     * The application scope required to access the route. Value can be a scope string or an array of scope strings. When authenticated, the credentials object scope property must contain at least
     * one of the scopes defined to access the route. If a scope string begins with a + character, that scope is required. If a scope string begins with a ! character, that scope is forbidden. For
     * example, the scope ['!a', '+b', 'c', 'd'] means the incoming request credentials' scope must not include 'a', must include 'b', and must include one of 'c' or 'd'. You may also access
     * properties on the request object (query, params, payload, and credentials) to populate a dynamic scope by using the '{' and '}' characters around the property name, such as 'user-{params.id}'.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthaccessscope)
     */
    scope?: MergeType<InternalRouteOptionType, RouteOptionTypes>['Scope'] | undefined;

    /**
     * @default 'any'.
     * The required authenticated entity type. If set, must match the entity value of the request authenticated credentials. Available values:
     * * 'any' - the authentication can be on behalf of a user or application.
     * * 'user' - the authentication must be on behalf of a user which is identified by the presence of a 'user' attribute in the credentials object returned by the authentication strategy.
     * * 'app' - the authentication must be on behalf of an application which is identified by the lack of presence of a user attribute in the credentials object returned by the authentication
     * strategy.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthaccessentity)
     */
    entity?: AccessEntity | undefined;

    /**
     * @default 'required'.
     * The authentication mode. Available values:
     * * 'required' - authentication is required.
     * * 'optional' - authentication is optional - the request must include valid credentials or no credentials at all.
     * * 'try' - similar to 'optional', any request credentials are attempted authentication, but if the credentials are invalid, the request proceeds regardless of the authentication error.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthmode)
     */
    mode?: AuthMode | undefined;

    /**
     * @default false, unless the scheme requires payload authentication.
     * If set, the incoming request payload is authenticated after it is processed. Requires a strategy with payload authentication support (e.g. Hawk). Cannot be set to a value other than 'required'
     * when the scheme sets the authentication options.payload to true. Available values:
     * * false - no payload authentication.
     * * 'required' - payload authentication required.
     * * 'optional' - payload authentication performed only when the client includes payload authentication information (e.g. hash attribute in Hawk).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthpayload)
     */
    payload?: false | 'required' | 'optional' | undefined;

    /**
     * @default the default strategy set via server.auth.default().
     * An array of string strategy names in the order they should be attempted. Cannot be used together with strategy.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthstrategies)
     */
    strategies?: (MergeType<InternalRouteOptionType, RouteOptionTypes>['Strategy'])[] | undefined;

    /**
     * @default the default strategy set via server.auth.default().
     * A string strategy names. Cannot be used together with strategies.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsauthstrategy)
     */
    strategy?: MergeType<InternalRouteOptionType, RouteOptionTypes>['Strategy'] | undefined;
}

/**
 * Values are:
 * * * 'default' - no privacy flag.
 * * * 'public' - mark the response as suitable for public caching.
 * * * 'private' - mark the response as suitable only for private caching.
 * * expiresIn - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with expiresAt.
 * * expiresAt - time of day expressed in 24h notation using the 'HH:MM' format, at which point all cache records for the route expire. Cannot be used together with expiresIn.
 * * statuses - an array of HTTP response status code numbers (e.g. 200) which are allowed to include a valid caching directive.
 * * otherwise - a string with the value of the 'Cache-Control' header when caching is disabled.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscache)
 */
export type RouteOptionsCache = {
    privacy?: 'default' | 'public' | 'private' | undefined;
    statuses?: number[] | undefined;
    otherwise?: string | undefined;
} & (
    {
        expiresIn?: number | undefined;
        expiresAt?: undefined;
    } | {
    expiresIn?: undefined;
    expiresAt?: string | undefined;
} | {
    expiresIn?: undefined;
    expiresAt?: undefined;
}
    );

/**
 * @default false (no CORS headers).
 * The Cross-Origin Resource Sharing protocol allows browsers to make cross-origin API calls. CORS is required by web applications running inside a browser which are loaded from a different domain
 * than the API server. To enable, set cors to true, or to an object with the following options:
 * * origin - an array of allowed origin servers strings ('Access-Control-Allow-Origin'). The array can contain any combination of fully qualified origins along with origin strings containing a
 * wildcard '*' character, or a single '*' origin string. If set to 'ignore', any incoming Origin header is ignored (present or not) and the 'Access-Control-Allow-Origin' header is set to '*'.
 * Defaults to any origin ['*'].
 * * maxAge - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser checks for changes in policy.
 * Defaults to 86400 (one day).
 * * headers - a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to ['Accept', 'Authorization', 'Content-Type', 'If-None-Match'].
 * * additionalHeaders - a strings array of additional headers to headers. Use this to keep the default headers in place.
 * * exposedHeaders - a strings array of exposed headers ('Access-Control-Expose-Headers'). Defaults to ['WWW-Authenticate', 'Server-Authorization'].
 * * additionalExposedHeaders - a strings array of additional headers to exposedHeaders. Use this to keep the default headers in place.
 * * credentials - if true, allows user credentials to be sent ('Access-Control-Allow-Credentials'). Defaults to false.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscors)
 */
export interface RouteOptionsCors {
    /**
     * an array of allowed origin servers strings ('Access-Control-Allow-Origin'). The array can contain any combination of fully qualified origins along with origin strings containing a wildcard '*'
     * character, or a single '*' origin string. If set to 'ignore', any incoming Origin header is ignored (present or not) and the 'Access-Control-Allow-Origin' header is set to '*'. Defaults to any
     * origin ['*'].
     */
    origin?: string[] | '*' | 'ignore' | undefined;
    /**
     * number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser checks for changes in policy.
     * Defaults to 86400 (one day).
     */
    maxAge?: number | undefined;
    /**
     * a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to ['Accept', 'Authorization', 'Content-Type', 'If-None-Match'].
     */
    headers?: string[] | undefined;
    /**
     * a strings array of additional headers to headers. Use this to keep the default headers in place.
     */
    additionalHeaders?: string[] | undefined;
    /**
     * a strings array of exposed headers ('Access-Control-Expose-Headers'). Defaults to ['WWW-Authenticate', 'Server-Authorization'].
     */
    exposedHeaders?: string[] | undefined;
    /**
     * a strings array of additional headers to exposedHeaders. Use this to keep the default headers in place.
     */
    additionalExposedHeaders?: string[] | undefined;
    /**
     * if true, allows user credentials to be sent ('Access-Control-Allow-Credentials'). Defaults to false.
     */
    credentials?: boolean | undefined;
    /**
     * the status code used for CORS preflight responses, either 200 or 204. Defaults to 200.
     */
    preflightStatusCode?: 200 | 204;
}

/**
 * The value must be one of:
 * * 'data' - the incoming payload is read fully into memory. If parse is true, the payload is parsed (JSON, form-decoded, multipart) based on the 'Content-Type' header. If parse is false, a raw
 * Buffer is returned.
 * * 'stream' - the incoming payload is made available via a Stream.Readable interface. If the payload is 'multipart/form-data' and parse is true, field values are presented as text while files are
 * provided as streams. File streams from a 'multipart/form-data' upload will also have a hapi property containing the filename and headers properties. Note that payload streams for multipart
 * payloads are a synthetic interface created on top of the entire multipart content loaded into memory. To avoid loading large multipart payloads into memory, set parse to false and handle the
 * multipart payload in the handler using a streaming parser (e.g. pez).
 * * 'file' - the incoming payload is written to temporary file in the directory specified by the uploads settings. If the payload is 'multipart/form-data' and parse is true, field values are
 * presented as text while files are saved to disk. Note that it is the sole responsibility of the application to clean up the files generated by the framework. This can be done by keeping track of
 * which files are used (e.g. using the request.app object), and listening to the server 'response' event to perform cleanup. For context [See
 * docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadoutput)
 */
export type PayloadOutput = 'data' | 'stream' | 'file';

/**
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadcompression)
 */
export type PayloadCompressionDecoderSettings = object;

/**
 * Determines how the request payload is processed.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayload)
 */
export interface RouteOptionsPayload {
    /**
     * @default allows parsing of the following mime types:
     * * application/json
     * * application/*+json
     * * application/octet-stream
     * * application/x-www-form-urlencoded
     * * multipart/form-data
     * * text/*
     * A string or an array of strings with the allowed mime types for the endpoint. Use this settings to limit the set of allowed mime types. Note that allowing additional mime types not listed
     * above will not enable them to be parsed, and if parse is true, the request will result in an error response.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadallow)
     */
    allow?: string | string[] | undefined;

    /**
     * @default none.
     * An object where each key is a content-encoding name and each value is an object with the desired decoder settings. Note that encoder settings are set in compression.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadcompression)
     */
    compression?: Record<string, PayloadCompressionDecoderSettings> | undefined;

    /**
     * @default 'application/json'.
     * The default content type if the 'Content-Type' request header is missing.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloaddefaultcontenttype)
     */
    defaultContentType?: string | undefined;

    /**
     * @default 'error' (return a Bad Request (400) error response).
     * A failAction value which determines how to handle payload parsing errors.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadfailaction)
     */
    failAction?: Lifecycle.FailAction | undefined;

    /**
     * @default 1048576 (1MB).
     * Limits the size of incoming payloads to the specified byte count. Allowing very large payloads may cause the server to run out of memory.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadmaxbytes)
     */
    maxBytes?: number | undefined;

    /**
     * @default none.
     * Overrides payload processing for multipart requests. Value can be one of:
     * * false - disable multipart processing.
     * an object with the following required options:
     * * output - same as the output option with an additional value option:
     * * * annotated - wraps each multipart part in an object with the following keys: // TODO type this?
     * * * * headers - the part headers.
     * * * * filename - the part file name.
     * * * * payload - the processed part payload.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadmultipart)
     */
    multipart?:
        | false
        | {
              output: PayloadOutput | 'annotated';
          }
        | undefined;

    /**
     * @default 'data'.
     * The processed payload format. The value must be one of:
     * * 'data' - the incoming payload is read fully into memory. If parse is true, the payload is parsed (JSON, form-decoded, multipart) based on the 'Content-Type' header. If parse is false, a raw
     * Buffer is returned.
     * * 'stream' - the incoming payload is made available via a Stream.Readable interface. If the payload is 'multipart/form-data' and parse is true, field values are presented as text while files
     * are provided as streams. File streams from a 'multipart/form-data' upload will also have a hapi property containing the filename and headers properties. Note that payload streams for multipart
     * payloads are a synthetic interface created on top of the entire multipart content loaded into memory. To avoid loading large multipart payloads into memory, set parse to false and handle the
     * multipart payload in the handler using a streaming parser (e.g. pez).
     * * 'file' - the incoming payload is written to temporary file in the directory specified by the uploads settings. If the payload is 'multipart/form-data' and parse is true, field values are
     * presented as text while files are saved to disk. Note that it is the sole responsibility of the application to clean up the files generated by the framework. This can be done by keeping track
     * of which files are used (e.g. using the request.app object), and listening to the server 'response' event to perform cleanup.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadoutput)
     */
    output?: PayloadOutput | undefined;

    /**
     * @default none.
     * A mime type string overriding the 'Content-Type' header value received.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadoverride)
     */
    override?: string | undefined;

    /**
     * @default true.
     * Determines if the incoming payload is processed or presented raw. Available values:
     * * true - if the request 'Content-Type' matches the allowed mime types set by allow (for the whole payload as well as parts), the payload is converted into an object when possible. If the
     * format is unknown, a Bad Request (400) error response is sent. Any known content encoding is decoded.
     * * false - the raw payload is returned unmodified.
     * * 'gunzip' - the raw payload is returned unmodified after any known content encoding is decoded.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadparse)
     */
    parse?: boolean | 'gunzip' | undefined;

    /**
     * @default to 'error'.
     * Sets handling of incoming payload that may contain a prototype poisoning security attack.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadprotoaction)
     */
    protoAction?: 'error' | 'remove' | 'ignore';

    /**
     * @default to 10000 (10 seconds).
     * Payload reception timeout in milliseconds. Sets the maximum time allowed for the client to transmit the request payload (body) before giving up and responding with a Request Timeout (408)
     * error response. Set to false to disable.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloadtimeout)
     */
    timeout?: false | number | undefined;

    /**
     * @default os.tmpdir().
     * The directory used for writing file uploads.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayloaduploads)
     */
    uploads?: string | undefined;
}

/**
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspre)
 */
export type RouteOptionsPreArray<Refs extends ReqRef = ReqRefDefaults> = RouteOptionsPreAllOptions<Refs>[];

/**
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspre)
 */
export type RouteOptionsPreAllOptions<Refs extends ReqRef = ReqRefDefaults> = RouteOptionsPreObject<Refs> | RouteOptionsPreObject<Refs>[] | Lifecycle.Method<Refs>;

/**
 * An object with:
 * * method - a lifecycle method.
 * * assign - key name used to assign the response of the method to in request.pre and request.preResponses.
 * * failAction - A failAction value which determine what to do when a pre-handler method throws an error. If assign is specified and the failAction setting is not 'error', the error will be assigned.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspre)
 */
export interface RouteOptionsPreObject<Refs extends ReqRef = ReqRefDefaults> {
    /**
     * a lifecycle method.
     */
    method: Lifecycle.Method<Refs>;
    /**
     * key name used to assign the response of the method to in request.pre and request.preResponses.
     */
    assign?: keyof Refs['Pres'] | undefined;
    /**
     * A failAction value which determine what to do when a pre-handler method throws an error. If assign is specified and the failAction setting is not 'error', the error will be assigned.
     */
    failAction?: Lifecycle.FailAction | undefined;
}

export type ValidationObject = SchemaMap;

/**
 * * true - any query parameter value allowed (no validation performed). false - no parameter value allowed.
 * * a joi validation object.
 * * a validation function using the signature async function(value, options) where:
 * * * value - the request.* object containing the request parameters.
 * * * options - options.
 */
export type RouteOptionsResponseSchema =
    boolean
    | ValidationObject
    | Schema
    | ((value: object | Buffer | string, options: ValidationOptions) => Promise<any>);

/**
 * Processing rules for the outgoing response.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponse)
 */
export interface RouteOptionsResponse {
    /**
     * @default 204.
     * The default HTTP status code when the payload is considered empty. Value can be 200 or 204. Note that a 200 status code is converted to a 204 only at the time of response transmission (the
     * response status code will remain 200 throughout the request lifecycle unless manually set).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponseemptystatuscode)
     */
    emptyStatusCode?: 200 | 204 | undefined;

    /**
     * @default 'error' (return an Internal Server Error (500) error response).
     * A failAction value which defines what to do when a response fails payload validation.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponsefailaction)
     */
    failAction?: Lifecycle.FailAction | undefined;

    /**
     * @default false.
     * If true, applies the validation rule changes to the response payload.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponsemodify)
     */
    modify?: boolean | undefined;

    /**
     * @default none.
     * [joi](https://github.com/hapijs/joi) options object pass to the validation function. Useful to set global options such as stripUnknown or abortEarly (the complete list is available here). If a
     * custom validation function is defined via schema or status then options can an arbitrary object that will be passed to this function as the second argument.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponseoptions)
     */
    options?: ValidationOptions | undefined; // TODO needs validation

    /**
     * @default true.
     * If false, payload range support is disabled.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponseranges)
     */
    ranges?: boolean | undefined;

    /**
     * @default 100 (all responses).
     * The percent of response payloads validated (0 - 100). Set to 0 to disable all validation.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponsesample)
     */
    sample?: number | undefined;

    /**
     * @default true (no validation).
     * The default response payload validation rules (for all non-error responses) expressed as one of:
     * * true - any payload allowed (no validation).
     * * false - no payload allowed.
     * * a joi validation object. The options along with the request context ({ headers, params, query, payload, app, auth }) are passed to the validation function.
     * * a validation function using the signature async function(value, options) where:
     * * * value - the pending response payload.
     * * * options - The options along with the request context ({ headers, params, query, payload, app, auth }).
     * * * if the function returns a value and modify is true, the value is used as the new response. If the original response is an error, the return value is used to override the original error
     * output.payload. If an error is thrown, the error is processed according to failAction.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponseschema)
     */
    schema?: RouteOptionsResponseSchema | undefined;

    /**
     * @default none.
     * Validation schemas for specific HTTP status codes. Responses (excluding errors) not matching the listed status codes are validated using the default schema.
     * status is set to an object where each key is a 3 digit HTTP status code and the value has the same definition as schema.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponsestatus)
     */
    status?: Record<string, RouteOptionsResponseSchema> | undefined;

    /**
     * The default HTTP status code used to set a response error when the request is closed or aborted before the
     * response is fully transmitted.
     * Value can be any integer greater or equal to 400.
     * The default value 499 is based on the non-standard nginx "CLIENT CLOSED REQUEST" error.
     * The value is only used for logging as the request has already ended.
     * @default 499
     */
    disconnectStatusCode?: number | undefined;
}

/**
 * @see https://www.w3.org/TR/referrer-policy/
 */
export type ReferrerPolicy = '' | 'no-referrer' | 'no-referrer-when-downgrade' | 'unsafe-url' |
    'same-origin' | 'origin' |  'strict-origin' | 'origin-when-cross-origin' | 'strict-origin-when-cross-origin';

/**
 * @default false (security headers disabled).
 * Sets common security headers. To enable, set security to true or to an object with the following options:
 * * hsts - controls the 'Strict-Transport-Security' header, where:
 * * * true - the header will be set to max-age=15768000. This is the default value.
 * * * a number - the maxAge parameter will be set to the provided value.
 * * * an object with the following fields:
 * * * * maxAge - the max-age portion of the header, as a number. Default is 15768000.
 * * * * includeSubDomains - a boolean specifying whether to add the includeSubDomains flag to the header.
 * * * * preload - a boolean specifying whether to add the 'preload' flag (used to submit domains inclusion in Chrome's HTTP Strict Transport Security (HSTS) preload list) to the header.
 * * xframe - controls the 'X-Frame-Options' header, where:
 * * * true - the header will be set to 'DENY'. This is the default value.
 * * * 'deny' - the headers will be set to 'DENY'.
 * * * 'sameorigin' - the headers will be set to 'SAMEORIGIN'.
 * * * an object for specifying the 'allow-from' rule, where:
 * * * * rule - one of:
 * * * * * 'deny'
 * * * * * 'sameorigin'
 * * * * * 'allow-from'
 * * * * source - when rule is 'allow-from' this is used to form the rest of the header, otherwise this field is ignored. If rule is 'allow-from' but source is unset, the rule will be automatically
 * changed to 'sameorigin'.
 * * xss - controls the 'X-XSS-Protection' header, where:
 * * * 'disable' - the header will be set to '0'. This is the default value.
 * * * 'enable' - the header will be set to '1; mode=block'.
 * * * false - the header will be omitted
 * * noOpen - boolean controlling the 'X-Download-Options' header for Internet Explorer, preventing downloads from executing in your context. Defaults to true setting the header to 'noopen'.
 * * noSniff - boolean controlling the 'X-Content-Type-Options' header. Defaults to true setting the header to its only and default option, 'nosniff'.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionssecurity)
 */
export interface RouteOptionsSecureObject {
    /**
     * hsts - controls the 'Strict-Transport-Security' header
     */
    hsts?: boolean | number | {
        /**
         * the max-age portion of the header, as a number. Default is 15768000.
         */
        maxAge?: number;
        /**
         * a boolean specifying whether to add the includeSubDomains flag to the header.
         */
        includeSubDomains?: boolean;
        /**
         * a boolean specifying whether to add the 'preload' flag (used to submit domains inclusion in Chrome's HTTP Strict Transport Security (HSTS) preload list) to the header.
         */
        preload?: boolean;
    } | undefined;
    /**
     * controls the 'X-Frame-Options' header
     */
    xframe?: true | 'deny' | 'sameorigin' | {
        /**
         * an object for specifying the 'allow-from' rule,
         */
        rule: 'deny' | 'sameorigin' | 'allow-from';
        /**
         * when rule is 'allow-from' this is used to form the rest of the header, otherwise this field is ignored. If rule is 'allow-from' but source is unset, the rule will be automatically changed
         * to 'sameorigin'.
         */
        source: string;
    } | undefined;
    /**
     * controls the 'X-XSS-Protection' header, where:
     * * 'disable' - the header will be set to '0'. This is the default value.
     * * 'enable' - the header will be set to '1; mode=block'.
     * * false - the header will be omitted
     */
    xss?: 'disable' | 'enable' | false | undefined;
    /**
     * boolean controlling the 'X-Download-Options' header for Internet Explorer, preventing downloads from executing in your context. Defaults to true setting the header to 'noopen'.
     */
    noOpen?: boolean | undefined;
    /**
     * boolean controlling the 'X-Content-Type-Options' header. Defaults to true setting the header to its only and default option, 'nosniff'.
     */
    noSniff?: boolean | undefined;

    /**
     * Controls the `Referrer-Policy` header, which has the following possible values.
     * @default false Header will not be send.
     */
    referrer?: false | ReferrerPolicy | undefined;
}

export type RouteOptionsSecure = boolean | RouteOptionsSecureObject;

/**
 * @default { headers: true, params: true, query: true, payload: true, failAction: 'error' }.
 * Request input validation rules for various request components.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidate)
 */
export interface RouteOptionsValidate {
    /**
     * @default none.
     * An optional object with error fields copied into every validation error response.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidateerrorfields)
     */
    errorFields?: object | undefined;

    /**
     * @default 'error' (return a Bad Request (400) error response).
     * A failAction value which determines how to handle failed validations. When set to a function, the err argument includes the type of validation error under err.output.payload.validation.source.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidatefailaction)
     */
    failAction?: Lifecycle.FailAction | undefined;

    /**
     * Validation rules for incoming request headers:
     * * If a value is returned, the value is used as the new request.headers value and the original value is stored in request.orig.headers. Otherwise, the headers are left unchanged. If an error
     * is thrown, the error is handled according to failAction. Note that all header field names must be in lowercase to match the headers normalized by node.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidateheaders)
     * @default true
     */
    headers?: RouteOptionsResponseSchema | undefined;

    /**
     * An options object passed to the joi rules or the custom validation methods. Used for setting global options such as stripUnknown or abortEarly (the complete list is available here).
     * If a custom validation function (see headers, params, query, or payload above) is defined then options can an arbitrary object that will be passed to this function as the second parameter.
     * The values of the other inputs (i.e. headers, query, params, payload, app, and auth) are added to the options object under the validation context (accessible in rules as
     * Joi.ref('$query.key')).
     * Note that validation is performed in order (i.e. headers, params, query, and payload) and if type casting is used (e.g. converting a string to a number), the value of inputs not yet validated
     * will reflect the raw, unvalidated and unmodified values. If the validation rules for headers, params, query, and payload are defined at both the server routes level and at the route level, the
     * individual route settings override the routes defaults (the rules are not merged).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidateparams)
     * @default true
     */
    options?: ValidationOptions | object | undefined;

    /**
     * Validation rules for incoming request path parameters, after matching the path against the route, extracting any parameters, and storing them in request.params, where:
     * * true - any path parameter value allowed (no validation performed).
     * * a joi validation object.
     * * a validation function using the signature async function(value, options) where:
     * * * value - the request.params object containing the request path parameters.
     * * * options - options.
     * if a value is returned, the value is used as the new request.params value and the original value is stored in request.orig.params. Otherwise, the path parameters are left unchanged. If an
     * error is thrown, the error is handled according to failAction. Note that failing to match the validation rules to the route path parameters definition will cause all requests to fail.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidateparams)
     * @default true
     */
    params?: RouteOptionsResponseSchema | undefined;

    /**
     * Validation rules for incoming request payload (request body), where:
     * * If a value is returned, the value is used as the new request.payload value and the original value is stored in request.orig.payload. Otherwise, the payload is left unchanged. If an error is
     * thrown, the error is handled according to failAction. Note that validating large payloads and modifying them will cause memory duplication of the payload (since the original is kept), as well
     * as the significant performance cost of validating large amounts of data.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidatepayload)
     * @default true
     */
    payload?: RouteOptionsResponseSchema | undefined;

    /**
     * Validation rules for incoming request URI query component (the key-value part of the URI between '?' and '#'). The query is parsed into its individual key-value pairs, decoded, and stored in
     * request.query prior to validation. Where:
     * * If a value is returned, the value is used as the new request.query value and the original value is stored in request.orig.query. Otherwise, the query parameters are left unchanged.
     * If an error
     * is thrown, the error is handled according to failAction. Note that changes to the query parameters will not be reflected in request.url.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidatequery)
     * @default true
     */
    query?: RouteOptionsResponseSchema | undefined;

    /**
     * Validation rules for incoming cookies.
     * The cookie header is parsed and decoded into the request.state prior to validation.
     * @default true
     */
    state?: RouteOptionsResponseSchema | undefined;
}

/**
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscompression)
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-serverencoderencoding-encoder)
 */
export type RouteCompressionEncoderSettings = object;

export interface CommonRouteProperties<Refs extends ReqRef = ReqRefDefaults> {
    /**
     * Application-specific route configuration state. Should not be used by plugins which should use options.plugins[name] instead.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsapp)
     */
    app?:  MergeRefs<Refs>['RouteApp'] | undefined;

    /**
     * @default null.
     * An object passed back to the provided handler (via this) when called. Ignored if the method is an arrow function.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsbind)
     */
    bind?: MergeRefs<Refs>['Bind'] | undefined;

    /**
     * @default { privacy: 'default', statuses: [200], otherwise: 'no-cache' }.
     * If the route method is 'GET', the route can be configured to include HTTP caching directives in the response. Caching can be customized using an object with the following options:
     * privacy - determines the privacy flag included in client-side caching using the 'Cache-Control' header. Values are:
     * * * 'default' - no privacy flag.
     * * * 'public' - mark the response as suitable for public caching.
     * * * 'private' - mark the response as suitable only for private caching.
     * * expiresIn - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with expiresAt.
     * * expiresAt - time of day expressed in 24h notation using the 'HH:MM' format, at which point all cache records for the route expire. Cannot be used together with expiresIn.
     * * statuses - an array of HTTP response status code numbers (e.g. 200) which are allowed to include a valid caching directive.
     * * otherwise - a string with the value of the 'Cache-Control' header when caching is disabled.
     * The default Cache-Control: no-cache header can be disabled by setting cache to false.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscache)
     */
    cache?: false | RouteOptionsCache | undefined;

    /**
     * An object where each key is a content-encoding name and each value is an object with the desired encoder settings. Note that decoder settings are set in compression.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscompression)
     */
    compression?: Record<string, RouteCompressionEncoderSettings> | undefined;

    /**
     * @default false (no CORS headers).
     * The Cross-Origin Resource Sharing protocol allows browsers to make cross-origin API calls. CORS is required by web applications running inside a browser which are loaded from a different
     * domain than the API server. To enable, set cors to true, or to an object with the following options:
     * * origin - an array of allowed origin servers strings ('Access-Control-Allow-Origin'). The array can contain any combination of fully qualified origins along with origin strings containing a
     * wildcard '*' character, or a single '*' origin string. If set to 'ignore', any incoming Origin header is ignored (present or not) and the 'Access-Control-Allow-Origin' header is set to '*'.
     * Defaults to any origin ['*'].
     * * maxAge - number of seconds the browser should cache the CORS response ('Access-Control-Max-Age'). The greater the value, the longer it will take before the browser checks for changes in
     * policy. Defaults to 86400 (one day).
     * * headers - a strings array of allowed headers ('Access-Control-Allow-Headers'). Defaults to ['Accept', 'Authorization', 'Content-Type', 'If-None-Match'].
     * * additionalHeaders - a strings array of additional headers to headers. Use this to keep the default headers in place.
     * * exposedHeaders - a strings array of exposed headers ('Access-Control-Expose-Headers'). Defaults to ['WWW-Authenticate', 'Server-Authorization'].
     * * additionalExposedHeaders - a strings array of additional headers to exposedHeaders. Use this to keep the default headers in place.
     * * credentials - if true, allows user credentials to be sent ('Access-Control-Allow-Credentials'). Defaults to false.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionscors)
     */
    cors?: boolean | RouteOptionsCors | undefined;

    /**
     * @default none.
     * Route description used for generating documentation (string).
     * This setting is not available when setting server route defaults using server.options.routes.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsdescription)
     */
    description?: string | undefined;

    /**
     * @default none.
     * Route-level request extension points by setting the option to an object with a key for each of the desired extension points ('onRequest' is not allowed), and the value is the same as the
     * server.ext(events) event argument.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsext)
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#request-lifecycle)
     */
    ext?: {
        [key in RouteRequestExtType]?: RouteExtObject | RouteExtObject[] | undefined;
    } | undefined;

    /**
     * @default { relativeTo: '.' }.
     * Defines the behavior for accessing files:
     * * relativeTo - determines the folder relative paths are resolved against.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsfiles)
     */
    files?: {
        relativeTo: string;
    } | undefined;

    /**
     * @default none.
     * The route handler function performs the main business logic of the route and sets the response. handler can be assigned:
     * * a lifecycle method.
     * * an object with a single property using the name of a handler type registered with the server.handler() method. The matching property value is passed as options to the registered handler
     * generator. Note: handlers using a fat arrow style function cannot be bound to any bind property. Instead, the bound context is available under h.context.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionshandler)
     */
    handler?: Lifecycle.Method<Refs> | object | undefined;

    /**
     * @default none.
     * An optional unique identifier used to look up the route using server.lookup(). Cannot be assigned to routes added with an array of methods.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsid)
     */
    id?: string | undefined;

    /**
     * @default false.
     * If true, the route cannot be accessed through the HTTP listener but only through the server.inject() interface with the allowInternals option set to true. Used for internal routes that should
     * not be accessible to the outside world.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsisinternal)
     */
    isInternal?: boolean | undefined;

    /**
     * @default none.
     * Optional arguments passed to JSON.stringify() when converting an object or error response to a string payload or escaping it after stringification. Supports the following:
     * * replacer - the replacer function or array. Defaults to no action.
     * * space - number of spaces to indent nested object keys. Defaults to no indentation.
     * * suffix - string suffix added after conversion to JSON string. Defaults to no suffix.
     * * escape - calls Hoek.jsonEscape() after conversion to JSON string. Defaults to false.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsjson)
     */
    json?: Json.StringifyArguments | undefined;

    /**
     * @default { collect: false }.
     * Request logging options:
     * collect - if true, request-level logs (both internal and application) are collected and accessible via request.logs.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionslog)
     */
    log?: {
        collect: boolean;
    } | undefined;

    /**
     * @default none.
     * Route notes used for generating documentation (string or array of strings).
     * This setting is not available when setting server route defaults using server.options.routes.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsnotes)
     */
    notes?: string | string[] | undefined;

    /**
     * Determines how the request payload is processed.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspayload)
     */
    payload?: RouteOptionsPayload | undefined;

    /**
     * @default {}.
     * Plugin-specific configuration. plugins is an object where each key is a plugin name and the value is the plugin configuration.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsplugins)
     */
    plugins?: PluginSpecificConfiguration | undefined;

    /**
     * @default none.
     * The pre option allows defining methods for performing actions before the handler is called. These methods allow breaking the handler logic into smaller, reusable components that can be shared
     * across routes, as well as provide a cleaner error handling of prerequisite operations (e.g. load required reference data from a database). pre is assigned an ordered array of methods which
     * are called serially in order. If the pre array contains another array of methods as one of its elements, those methods are called in parallel. Note that during parallel execution, if any of
     * the methods error, return a takeover response, or abort signal, the other parallel methods will continue to execute but will be ignored once completed. pre can be assigned a mixed array of:
     * * an array containing the elements listed below, which are executed in parallel.
     * * an object with:
     * * * method - a lifecycle method.
     * * * assign - key name used to assign the response of the method to in request.pre and request.preResponses.
     * * * failAction - A failAction value which determine what to do when a pre-handler method throws an error. If assign is specified and the failAction setting is not 'error', the error will be
     * assigned.
     * * a method function - same as including an object with a single method key.
     * Note that pre-handler methods do not behave the same way other lifecycle methods do when a value is returned. Instead of the return value becoming the new response payload, the value is used
     * to assign the corresponding request.pre and request.preResponses properties. Otherwise, the handling of errors, takeover response response, or abort signal behave the same as any other
     * lifecycle methods.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionspre)
     */
    pre?: RouteOptionsPreArray<Refs> | undefined;

    /**
     * Processing rules for the outgoing response.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsresponse)
     */
    response?: RouteOptionsResponse | undefined;

    /**
     * @default false (security headers disabled).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionssecurity)
     */
    security?: RouteOptionsSecure | undefined;

    /**
     * @default { parse: true, failAction: 'error' }.
     * HTTP state management (cookies) allows the server to store information on the client which is sent back to the server with every request (as defined in RFC 6265). state supports the following
     * options: parse - determines if incoming 'Cookie' headers are parsed and stored in the request.state object. failAction - A failAction value which determines how to handle cookie parsing
     * errors. Defaults to 'error' (return a Bad Request (400) error response).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsstate)
     */
    state?: {
        parse?: boolean | undefined;
        failAction?: Lifecycle.FailAction | undefined;
    } | undefined;

    /**
     * @default none.
     * Route tags used for generating documentation (array of strings).
     * This setting is not available when setting server route defaults using server.options.routes.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionstags)
     */
    tags?: string[] | undefined;

    /**
     * @default { server: false }.
     * Timeouts for processing durations.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionstimeout)
     */
    timeout?: {
        /**
         * Response timeout in milliseconds. Sets the maximum time allowed for the server to respond to an incoming request before giving up and responding with a Service Unavailable (503) error
         * response.
         */
        server?: boolean | number | undefined;

        /**
         * @default none (use node default of 2 minutes).
         * By default, node sockets automatically timeout after 2 minutes. Use this option to override this behavior. Set to false to disable socket timeouts.
         */
        socket?: boolean | number | undefined;
    } | undefined;

    /**
     * @default { headers: true, params: true, query: true, payload: true, failAction: 'error' }.
     * Request input validation rules for various request components.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsvalidate)
     */
    validate?: RouteOptionsValidate | undefined;
}

export interface AccessScopes {
    forbidden?: string[] | undefined;
    required?: string[] | undefined;
    selection?: string[] | undefined;
}

export interface AccessSetting {
    entity?: AccessEntity | undefined;
    scope: AccessScopes | false;
}

export interface AuthSettings {
    strategies: string[];
    mode: AuthMode;
    access?: AccessSetting[] | undefined;
}

export interface RouteSettings<Refs extends ReqRef = ReqRefDefaults> extends CommonRouteProperties<Refs> {
    auth?: AuthSettings | undefined;
}

/**
 * Each route can be customized to change the default behavior of the request lifecycle.
 * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#route-options)
 */
export interface RouteOptions<Refs extends ReqRef = ReqRefDefaults> extends CommonRouteProperties<Refs> {
    /**
     * Route authentication configuration. Value can be:
     * false to disable authentication if a default strategy is set.
     * a string with the name of an authentication strategy registered with server.auth.strategy(). The strategy will be set to 'required' mode.
     * an authentication configuration object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsapp)
     */
    auth?: false | string | RouteOptionsAccess | undefined;
}

export interface HandlerDecorations {}

export interface RouteRules {}

export interface RulesInfo {
    method: string;
    path: string;
    vhost: string;
}

export interface RulesOptions<Refs extends ReqRef = ReqRefDefaults> {
    validate: {
        schema?: ObjectSchema<MergeRefs<Refs>['Rules']> | Record<keyof MergeRefs<Refs>['Rules'], Schema> | undefined;
        options?: ValidationOptions | undefined;
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
    method: HTTP_METHODS_PARTIAL | HTTP_METHODS_PARTIAL[] | string | string[];

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
