
import { Podium } from '@hapi/podium';

import { PluginsStates, ServerRealm } from './plugin';
import {
    UserCredentials,
    AppCredentials,
    AuthArtifacts,
    AuthCredentials,
    ReqRef,
    ReqRefDefaults,
    MergeRefs,
    Request
} from './request';
import { PeekListener, Lifecycle, Json } from './utils';
import { ServerStateCookieOptions } from './server';

/**
 *  User-extensible type for application specific state on responses (`response.app`).
 */
export interface ResponseApplicationState {
}

/**
 * Access: read only and the public podium interface.
 * The response.events object supports the following events:
 * * 'peek' - emitted for each chunk of data written back to the client connection. The event method signature is function(chunk, encoding).
 * * 'finish' - emitted when the response finished writing but before the client response connection is ended. The event method signature is function ().
 * [See docs](https://hapijs.com/api/17.0.1#-responseevents)
 */
export interface ResponseEvents extends Podium {
    /**
     * 'peek' - emitted for each chunk of data written back to the client connection. The event method signature is function(chunk, encoding).
     * 'finish' - emitted when the response finished writing but before the client response connection is ended. The event method signature is function ().
     */
    on(criteria: 'peek', listener: PeekListener): this;

    on(criteria: 'finish', listener: (data: undefined) => void): this;

    /**
     * 'peek' - emitted for each chunk of data written back to the client connection. The event method signature is function(chunk, encoding).
     * 'finish' - emitted when the response finished writing but before the client response connection is ended. The event method signature is function ().
     */
    once(criteria: 'peek', listener: PeekListener): this;
    once(criteria: 'peek'): Promise<Parameters<PeekListener>>;

    once(criteria: 'finish', listener: (data: undefined) => void): this;
}

/**
 * Object where:
 *  * append - if true, the value is appended to any existing header value using separator. Defaults to false.
 *  * separator - string used as separator when appending to an existing value. Defaults to ','.
 *  * override - if false, the header value is not set if an existing value present. Defaults to true.
 *  * duplicate - if false, the header value is not modified if the provided value is already included. Does not apply when append is false or if the name is 'set-cookie'. Defaults to true.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseheadername-value-options)
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#response-object)
 */
export interface ResponseObjectHeaderOptions {
    append?: boolean | undefined;
    separator?: string | undefined;
    override?: boolean | undefined;
    duplicate?: boolean | undefined;
}

/**
 * The response object contains the request response value along with various HTTP headers and flags. When a lifecycle
 * method returns a value, the value is wrapped in a response object along with some default flags (e.g. 200 status
 * code). In order to customize a response before it is returned, the h.response() method is provided.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#response-object)
 * TODO, check extending from Podium is correct.  Extending because of "The response object supports the following events" [See docs](https://hapijs.com/api/17.0.1#-responseevents)
 */
export interface ResponseObject extends Podium {
    /**
     * @default {}.
     * Application-specific state. Provides a safe place to store application data without potential conflicts with the framework. Should not be used by plugins which should use plugins[name].
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseapp)
     */
    app: ResponseApplicationState;

    /**
     * Access: read only and the public podium interface.
     * The response.events object supports the following events:
     * * 'peek' - emitted for each chunk of data written back to the client connection. The event method signature is function(chunk, encoding).
     * * 'finish' - emitted when the response finished writing but before the client response connection is ended. The event method signature is function ().
     * [See docs](https://hapijs.com/api/17.0.1#-responseevents)
     */
    readonly events: ResponseEvents;

    /**
     * @default {}.
     * An object containing the response headers where each key is a header field name and the value is the string header value or array of string.
     * Note that this is an incomplete list of headers to be included with the response. Additional headers will be added once the response is prepared for transmission.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseheaders)
     */
    readonly headers: Record<string, string | string[]>;

    /**
     * @default {}.
     * Plugin-specific state. Provides a place to store and pass request-level plugin data. plugins is an object where each key is a plugin name and the value is the state.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseplugins)
     */
    plugins: PluginsStates;

    /**
     * Object containing the response handling flags.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsesettings)
     */
    readonly settings: ResponseSettings;

    /**
     * The raw value returned by the lifecycle method.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsesource)
     */
    readonly source: Lifecycle.ReturnValue;

    /**
     * @default 200.
     * The HTTP response status code.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsestatuscode)
     */
    readonly statusCode: number;

    /**
     * A string indicating the type of source with available values:
     * * 'plain' - a plain response such as string, number, null, or simple object.
     * * 'buffer' - a Buffer.
     * * 'stream' - a Stream.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsevariety)
     */
    readonly variety: 'plain' | 'buffer' | 'stream';

    /**
     * Sets the HTTP 'Content-Length' header (to avoid chunked transfer encoding) where:
     * @param length - the header value. Must match the actual payload size.
     * @return Return value: the current response object.
     * [See docs](https://hapijs.com/api/17.0.1#-responsebyteslength)
     */
    bytes(length: number): ResponseObject;

    /**
     * Controls the 'Content-Type' HTTP header 'charset' property of the response.
     *  * When invoked without any parameter, will prevent hapi from applying its default charset normalization to 'utf-8'
     *  * When 'charset' parameter is provided, will set the 'Content-Type' HTTP header 'charset' property where:
     * @param charset - the charset property value.
     * @return Return value: the current response object.
     * [See docs](https://hapijs.com/api/17.0.1#-responsecharsetcharset)
     */
    charset(charset?: string): ResponseObject | undefined;

    /**
     * Sets the HTTP status code where:
     * @param statusCode - the HTTP status code (e.g. 200).
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsecodestatuscode)
     */
    code(statusCode: number): ResponseObject;

    /**
     * Sets the HTTP status message where:
     * @param httpMessage - the HTTP status message (e.g. 'Ok' for status code 200).
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsemessagehttpmessage)
     */
    message(httpMessage: string): ResponseObject;

    /**
     * Sets the HTTP 'content-encoding' header where:
     * @param encoding - the header value string.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsecompressedencoding)
     */
    compressed(encoding: string): ResponseObject;

    /**
     * Sets the HTTP status code to Created (201) and the HTTP 'Location' header where:
     * @param uri - an absolute or relative URI used as the 'Location' header value.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsecreateduri)
     */
    created(uri: string): ResponseObject;

    /**
     * Sets the string encoding scheme used to serial data into the HTTP payload where:
     * @param encoding  the encoding property value (see node Buffer encoding [See docs](https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings)).
     *  * 'ascii' - for 7-bit ASCII data only. This encoding is fast and will strip the high bit if set.
     *  * 'utf8' - Multibyte encoded Unicode characters. Many web pages and other document formats use UTF-8.
     *  * 'utf16le' - 2 or 4 bytes, little-endian encoded Unicode characters. Surrogate pairs (U+10000 to U+10FFFF) are supported.
     *  * 'ucs2' - Alias of 'utf16le'.
     *  * 'base64' - Base64 encoding. When creating a Buffer from a string, this encoding will also correctly accept "URL and Filename Safe Alphabet" as specified in RFC4648, Section 5.
     *  * 'latin1' - A way of encoding the Buffer into a one-byte encoded string (as defined by the IANA in RFC1345, page 63, to be the Latin-1 supplement block and C0/C1 control codes).
     *  * 'binary' - Alias for 'latin1'.
     *  * 'hex' - Encode each byte as two hexadecimal characters.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseencodingencoding)
     */
    encoding(encoding: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'latin1' | 'binary' | 'hex'): ResponseObject;

    /**
     * Sets the representation entity tag where:
     * @param tag - the entity tag string without the double-quote.
     * @param options - (optional) settings where:
     *  * weak - if true, the tag will be prefixed with the 'W/' weak signifier. Weak tags will fail to match identical tags for the purpose of determining 304 response status. Defaults to false.
     *  * vary - if true and content encoding is set or applied to the response (e.g 'gzip' or 'deflate'), the encoding name will be automatically added to the tag at transmission time (separated by
     *     a '-' character). Ignored when weak is true. Defaults to true.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseetagtag-options)
     */
    etag(tag: string, options?: {weak: boolean, vary: boolean} | undefined): ResponseObject;

    /**
     * Sets an HTTP header where:
     * @param name - the header name.
     * @param value - the header value.
     * @param options - (optional) object where:
     *  * append - if true, the value is appended to any existing header value using separator. Defaults to false.
     *  * separator - string used as separator when appending to an existing value. Defaults to ','.
     *  * override - if false, the header value is not set if an existing value present. Defaults to true.
     *  * duplicate - if false, the header value is not modified if the provided value is already included. Does not apply when append is false or if the name is 'set-cookie'. Defaults to true.
     *  @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseheadername-value-options)
     */
    header(name: string, value: string, options?: ResponseObjectHeaderOptions | undefined): ResponseObject;

    /**
     * Sets the HTTP 'Location' header where:
     * @param uri - an absolute or relative URI used as the 'Location' header value.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responselocationuri)
     */
    location(uri: string): ResponseObject;

    /**
     * Sets an HTTP redirection response (302) and decorates the response with additional methods, where:
     * @param uri - an absolute or relative URI used to redirect the client to another resource.
     * @return Return value: the current response object.
     * Decorates the response object with the response.temporary(), response.permanent(), and response.rewritable() methods to easily change the default redirection code (302).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseredirecturi)
     */
    redirect(uri: string): ResponseObject;

    /**
     * Sets the JSON.stringify() replacer argument where:
     * @param method - the replacer function or array. Defaults to none.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsereplacermethod)
     */
    replacer(method: Json.StringifyReplacer): ResponseObject;

    /**
     * Sets the JSON.stringify() space argument where:
     * @param count - the number of spaces to indent nested object keys. Defaults to no indentation.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsespacescount)
     */
    spaces(count: number): ResponseObject;

    /**
     * Sets an HTTP cookie where:
     * @param name - the cookie name.
     * @param value - the cookie value. If no options.encoding is defined, must be a string. See server.state() for supported encoding values.
     * @param options - (optional) configuration. If the state was previously registered with the server using server.state(), the specified keys in options are merged with the default server
     *     definition.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsestatename-value-options)
     */
    state(name: string, value: object | string, options?: ServerStateCookieOptions | undefined): ResponseObject;

    /**
     * Sets a string suffix when the response is process via JSON.stringify() where:
     * @param suffix - the string suffix.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsesuffixsuffix)
     */
    suffix(suffix: string): ResponseObject;

    /**
     * Overrides the default route cache expiration rule for this response instance where:
     * @param msec - the time-to-live value in milliseconds.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsettlmsec)
     */
    ttl(msec: number): ResponseObject;

    /**
     * Sets the HTTP 'Content-Type' header where:
     * @param mimeType - is the mime type.
     * @return Return value: the current response object.
     * Should only be used to override the built-in default for each response type.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsetypemimetype)
     */
    type(mimeType: string): ResponseObject;

    /**
     * Clears the HTTP cookie by setting an expired value where:
     * @param name - the cookie name.
     * @param options - (optional) configuration for expiring cookie. If the state was previously registered with the server using server.state(), the specified options are merged with the server
     *     definition.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responseunstatename-options)
     */
    unstate(name: string, options?: ServerStateCookieOptions | undefined): ResponseObject;

    /**
     * Adds the provided header to the list of inputs affected the response generation via the HTTP 'Vary' header where:
     * @param header - the HTTP request header name.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsevaryheader)
     */
    vary(header: string): ResponseObject;

    /**
     * Marks the response object as a takeover response.
     * @return Return value: the current response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsetakeover)
     */
    takeover(): ResponseObject;

    /**
     * Sets the status code to 302 or 307 (based on the response.rewritable() setting) where:
     * @param isTemporary - if false, sets status to permanent. Defaults to true.
     * @return Return value: the current response object.
     * Only available after calling the response.redirect() method.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsetemporaryistemporary)
     */
    temporary(isTemporary?: boolean): ResponseObject;

    /**
     * Sets the status code to 301 or 308 (based on the response.rewritable() setting) where:
     * @param isPermanent - if false, sets status to temporary. Defaults to true.
     * @return Return value: the current response object.
     * Only available after calling the response.redirect() method.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsepermanentispermanent)
     */
    permanent(isPermanent?: boolean): ResponseObject;

    /**
     * Sets the status code to 301/302 for rewritable (allows changing the request method from 'POST' to 'GET') or 307/308 for non-rewritable (does not allow changing the request method from 'POST'
     * to 'GET'). Exact code based on the response.temporary() or response.permanent() setting. Arguments:
     * @param isRewritable - if false, sets to non-rewritable. Defaults to true.
     * @return Return value: the current response object.
     * Only available after calling the response.redirect() method.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responserewritableisrewritable)
     */
    rewritable(isRewritable?: boolean): ResponseObject;
}

/**
 * Object containing the response handling flags.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-responsesettings)
 */
export interface ResponseSettings {
    /**
     * Defaults value: true.
     * If true and source is a Stream, copies the statusCode and headers properties of the stream object to the outbound response.
     */
    readonly passThrough: boolean;

    /**
     * @default null (use route defaults).
     * Override the route json options used when source value requires stringification.
     */
    readonly stringify: Json.StringifyArguments;

    /**
     * @default null (use route defaults).
     * If set, overrides the route cache with an expiration value in milliseconds.
     */
    readonly ttl: number;

    /**
     * @default false.
     * If true, a suffix will be automatically added to the 'ETag' header at transmission time (separated by a '-' character) when the HTTP 'Vary' header is present.
     */
    varyEtag: boolean;
}

/**
 * See more about Lifecycle
 * https://github.com/hapijs/hapi/blob/master/API.md#request-lifecycle
 *
 */

export type ResponseValue = string | object;

export interface AuthenticationData<

    AuthUser = UserCredentials,
    AuthApp = AppCredentials,
    CredentialsExtra = Record<string, unknown>,
    ArtifactsExtra = AuthArtifacts
> {
    credentials: AuthCredentials<AuthUser, AuthApp> & CredentialsExtra;
    artifacts?: ArtifactsExtra | undefined;
}

export interface Auth<
    AuthUser = UserCredentials,
    AuthApp = AppCredentials,
    CredentialsExtra = Record<string, unknown>,
    ArtifactsExtra = AuthArtifacts
> {
    readonly isAuth: true;
    readonly error?: Error | null | undefined;
    readonly data?: AuthenticationData<AuthUser, AuthApp, CredentialsExtra, ArtifactsExtra> | undefined;
}

/**
 * The response toolkit is a collection of properties and utilities passed to every [lifecycle method](https://github.com/hapijs/hapi/blob/master/API.md#lifecycle-methods)
 * It is somewhat hard to define as it provides both utilities for manipulating responses as well as other information. Since the
 * toolkit is passed as a function argument, developers can name it whatever they want. For the purpose of this
 * document the h notation is used. It is named in the spirit of the RethinkDB r method, with h for hapi.
 * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#response-toolkit)
 */
export interface ResponseToolkit<Refs extends ReqRef = ReqRefDefaults> {
    /**
     * A response symbol. When returned by a lifecycle method, the request lifecycle skips to the finalizing step
     * without further interaction with the node response stream. It is the developer's responsibility to write
     * and end the response directly via [request.raw.res](https://github.com/hapijs/hapi/blob/master/API.md#request.raw).
     */
    readonly abandon: symbol;

    /**
     * A response symbol. When returned by a lifecycle method, the request lifecycle skips to the finalizing step after
     * calling request.raw.res.end()) to close the the node response stream.
     */
    readonly close: symbol;

    /**
     * A response symbol. Provides access to the route or server context set via the route [bind](https://github.com/hapijs/hapi/blob/master/API.md#route.options.bind)
     * option or [server.bind()](https://github.com/hapijs/hapi/blob/master/API.md#server.bind()).
     */
    readonly context: any;

    /**
     * A response symbol. When returned by a lifecycle method, the request lifecycle continues without changing the response.
     */
    readonly continue: symbol;

    /**
     * The [server realm](https://github.com/hapijs/hapi/blob/master/API.md#server.realm) associated with the matching
     * route. Defaults to the root server realm in the onRequest step.
     */
    readonly realm: ServerRealm;

    /**
     * Access: read only and public request interface.
     * The [request] object. This is a duplication of the request lifecycle method argument used by
     * [toolkit decorations](https://github.com/hapijs/hapi/blob/master/API.md#server.decorate()) to access the current request.
     */
    readonly request: Readonly<Request<Refs>>;

    /**
     * Used by the [authentication] method to pass back valid credentials where:
     * @param data - an object with:
     * * credentials - (required) object representing the authenticated entity.
     * * artifacts - (optional) authentication artifacts object specific to the authentication scheme.
     * @return Return value: an internal authentication object.
     */
    authenticated <
        AuthUser = MergeRefs<Refs>['AuthUser'],
        AuthApp  = MergeRefs<Refs>['AuthApp'],
        CredentialsExtra = MergeRefs<Refs>['AuthCredentialsExtra'],
        ArtifactsExtra = MergeRefs<Refs>['AuthArtifactsExtra']
    >(
        data: (
            AuthenticationData<
                AuthUser,
                AuthApp,
                CredentialsExtra,
                ArtifactsExtra
            >
        )
    ): Auth<
        AuthUser,
        AuthApp,
        CredentialsExtra,
        ArtifactsExtra
    >;

    /**
     * Sets the response 'ETag' and 'Last-Modified' headers and checks for any conditional request headers to decide if
     * the response is going to qualify for an HTTP 304 (Not Modified). If the entity values match the request
     * conditions, h.entity() returns a response object for the lifecycle method to return as its value which will
     * set a 304 response. Otherwise, it sets the provided entity headers and returns undefined.
     * The method arguments are:
     * @param options - a required configuration object with:
     * * etag - the ETag string. Required if modified is not present. Defaults to no header.
     * * modified - the Last-Modified header value. Required if etag is not present. Defaults to no header.
     * * vary - same as the response.etag() option. Defaults to true.
     * @return Return value: - a response object if the response is unmodified. - undefined if the response has changed.
     * If undefined is returned, the developer must return a valid lifecycle method value. If a response is returned,
     * it should be used as the return value (but may be customize using the response methods).
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hentityoptions)
     */
    entity(options?: {etag?: string | undefined, modified?: string | undefined, vary?: boolean | undefined} | undefined): ResponseObject;

    /**
     * Redirects the client to the specified uri. Same as calling h.response().redirect(uri).
     * @param url
     * @return Returns a response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hredirecturi)
     */
    redirect(uri?: string | undefined): ResponseObject;

    /**
     * Wraps the provided value and returns a response object which allows customizing the response
     * (e.g. setting the HTTP status code, custom headers, etc.), where:
     * @param value - (optional) return value. Defaults to null.
     * @return Returns a response object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hresponsevalue)
     */
    response(value?: ResponseValue | undefined): ResponseObject;

    /**
     * Sets a response cookie using the same arguments as response.state().
     * @param name of the cookie
     * @param value of the cookie
     * @param (optional) ServerStateCookieOptions object.
     * @return Return value: none.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hstatename-value-options)
     */
    state(name: string, value: string | object, options?: ServerStateCookieOptions | undefined): void;

    /**
     * Used by the [authentication] method to indicate authentication failed and pass back the credentials received where:
     * @param error - (required) the authentication error.
     * @param data - (optional) an object with:
     * * credentials - (required) object representing the authenticated entity.
     * * artifacts - (optional) authentication artifacts object specific to the authentication scheme.
     * @return void.
     * The method is used to pass both the authentication error and the credentials. For example, if a request included
     * expired credentials, it allows the method to pass back the user information (combined with a 'try'
     * authentication mode) for error customization.
     * There is no difference between throwing the error or passing it with the h.unauthenticated() method is no credentials are passed, but it might still be helpful for code clarity.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hunauthenticatederror-data)
     */
    unauthenticated <
        AuthUser = MergeRefs<Refs>['AuthUser'],
        AuthApp = MergeRefs<Refs>['AuthApp'],
        CredentialsExtra = MergeRefs<Refs>['AuthCredentialsExtra'],
        ArtifactsExtra = MergeRefs<Refs>['AuthArtifactsExtra']
    >(
        error: Error,
        data?: (
            AuthenticationData<
                AuthUser,
                AuthApp,
                CredentialsExtra,
                ArtifactsExtra
            >
        ) | undefined
    ): Auth<
        AuthUser,
        AuthApp,
        CredentialsExtra,
        ArtifactsExtra
    >;

    /**
     * Clears a response cookie using the same arguments as
     * @param name of the cookie
     * @param options (optional) ServerStateCookieOptions object.
     * @return void.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-hunstatename-options)
     */
    unstate(name: string, options?: ServerStateCookieOptions | undefined): void;
}
