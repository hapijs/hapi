import * as https from 'https';
import * as stream from 'stream';

import { Boom } from '@hapi/boom';
import { ResponseObject as ShotResponseObject } from '@hapi/shot';

import {
    ReqRef,
    ReqRefDefaults,
    MergeRefs,
    Request} from './request';
import { ResponseToolkit, Auth } from './response';

export type HTTP_METHODS_PARTIAL_LOWERCASE = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';

export type HTTP_METHODS_PARTIAL =
    'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'OPTIONS'
    | HTTP_METHODS_PARTIAL_LOWERCASE;

export type HTTP_METHODS = 'HEAD' | 'head' | HTTP_METHODS_PARTIAL;

export type PeekListener = (chunk: string, encoding: string) => void;

export namespace Json {
    /**
     * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter}
     */
    type StringifyReplacer = ((key: string, value: any) => any) | (string | number)[] | undefined;

    /**
     * Any value greater than 10 is truncated.
     */
    type StringifySpace = number | string;

    /**
     * For context [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-routeoptionsjson)
     */
    interface StringifyArguments {
        /** the replacer function or array. Defaults to no action. */
        replacer?: StringifyReplacer | undefined;
        /** number of spaces to indent nested object keys. Defaults to no indentation. */
        space?: StringifySpace | undefined;
        /* string suffix added after conversion to JSON string. Defaults to no suffix. */
        suffix?: string | undefined;
        /* calls Hoek.jsonEscape() after conversion to JSON string. Defaults to false. */
        escape?: boolean | undefined;
    }
}

export namespace Lifecycle {
    /**
     * Lifecycle methods are the interface between the framework and the application. Many of the request lifecycle steps:
     * extensions, authentication, handlers, pre-handler methods, and failAction function values are lifecycle methods
     * provided by the developer and executed by the framework.
     * Each lifecycle method is a function with the signature await function(request, h, [err]) where:
     * * request - the request object.
     * * h - the response toolkit the handler must call to set a response and return control back to the framework.
     * * err - an error object available only when the method is used as a failAction value.
     */
    type Method<
        Refs extends ReqRef = ReqRefDefaults,
        R extends ReturnValue<any> = ReturnValue<Refs>
    > = (
            this: MergeRefs<Refs>['Bind'],
            request: Request<Refs>,
            h: ResponseToolkit<Refs>,
            err?: Error | undefined
        ) => R;

    /**
     * Each lifecycle method must return a value or a promise that resolves into a value. If a lifecycle method returns
     * without a value or resolves to an undefined value, an Internal Server Error (500) error response is sent.
     * The return value must be one of:
     * - Plain value: null, string, number, boolean
     * - Buffer object
     * - Error object: plain Error OR a Boom object.
     * - Stream object
     * - any object or array
     * - a toolkit signal:
     * - a toolkit method response:
     * - a promise object that resolve to any of the above values
     * For more info please [See docs](https://github.com/hapijs/hapi/blob/master/API.md#lifecycle-methods)
     */
    type ReturnValue<Refs extends ReqRef = ReqRefDefaults> = ReturnValueTypes<Refs> | (Promise<ReturnValueTypes<Refs>>);
    type ReturnValueTypes<Refs extends ReqRef = ReqRefDefaults> =
        (null | string | number | boolean) |
        (Buffer) |
        (Error | Boom) |
        (stream.Stream) |
        (object | object[]) |
        symbol |
        Auth<
            MergeRefs<Refs>['AuthUser'],
            MergeRefs<Refs>['AuthApp'],
            MergeRefs<Refs>['AuthCredentialsExtra'],
            MergeRefs<Refs>['AuthArtifactsExtra']
        > |
        ShotResponseObject;

    /**
     * Various configuration options allows defining how errors are handled. For example, when invalid payload is received or malformed cookie, instead of returning an error, the framework can be
     * configured to perform another action. When supported the failAction option supports the following values:
     * * 'error' - return the error object as the response.
     * * 'log' - report the error but continue processing the request.
     * * 'ignore' - take no action and continue processing the request.
     * * a lifecycle method with the signature async function(request, h, err) where:
     * * * request - the request object.
     * * * h - the response toolkit.
     * * * err - the error object.
     * [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-failaction-configuration)
     */
    type FailAction = 'error' | 'log' | 'ignore' | Method;
}
