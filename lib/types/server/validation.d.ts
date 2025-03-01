
import { Request, RequestRoute } from "../request";

export namespace Validation {

    export type ValidatedReqProperties = 'headers' | 'params' | 'query' | 'payload' | 'state';

    export interface Context {
        headers?: Request['headers'];
        params?: Request['params'];
        query?: Request['query'];
        payload?: Request['payload'];
        state?: Request['state'];
        auth: Request['auth'];
        app: {
            route: RequestRoute['settings']['app'];
            request: Request['app'];
        };
    }

    export type Value = Request['headers'] | Request['params'] | Request['query'] | Request['payload'] | Request['state'] | object | undefined;

    /**
     * This is called to validate user supplied values.
     *
     * @param value The raw value that needs to be validated.
     * @param options The validation options from the config along with a `context` object.
     *
     * @returns The validated, and possibly transformed, value. A returned promise will be resolved, and rejections will be treated as a validation error.
     *
     * @throws Any thrown value is considered a validation error.
     */
    export interface DirectValidator<T extends ValidatedReqProperties | null> {
        (value: T extends ValidatedReqProperties ? Request[T] : unknown, options: Record<any, unknown> & { context: Omit<Required<Validation.Context>, NonNullable<T>> }): any;
    }

    /**
     * Object that can be used to validate a `value`.
     */
    export interface Validator<Options extends object = never> {

        /**
         * This is called to validate user supplied values.
         *
         * @param value The raw value that needs to be validated.
         * @param options The validation options from the config along with a possible `context` object.
         *
         * @returns On object with the result. Either the validated, and possibly transformed, `{ value }` or an `{ error }`.
         */
        validate(value: Value, options: Options & { context?: Context }): { value: any } | { error: any };

        /**
         * This is called to validate user supplied values when a promise can be returned.
         *
         * @param value The raw value that needs to be validated.
         * @param options The validation options from the config along with a possible `context` object.
         *
         * @returns The validated, and possibly transformed, value. A returned promise will be resolved, and rejections will be treated as a validation error.
         *
         * @throws Any thrown value is considered a validation error.
         */
        validateAsync?<AsyncOptions extends object = Options>(value: Value, options: AsyncOptions & { context: Context }): Promise<any> | any;
    }

    /**
     * 
     */
    export interface Compiler {

        /**
         * Converts literal schema definition to a validator object.
         */
        compile(schema: object | any[], ...args: unknown[]): Validator;
    }

    export type ExtractedSchema<V extends Compiler | null> = V extends Compiler ? Parameters<V['compile']>[0] : never;

    export type ExtractedValidateFunc<V extends Compiler | null> =
        V extends Compiler ? ReturnType<V['compile']>['validate'] :
        never;

    export type ExtractedOptions<V extends Compiler | null> = V extends Compiler ? Omit<NonNullable<Parameters<ExtractedValidateFunc<V>>[1]>, 'context'> : object;
}