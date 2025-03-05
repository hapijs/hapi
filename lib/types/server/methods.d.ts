import { CacheStatisticsObject, PolicyOptions } from "@hapi/catbox";

type AnyMethod = (...args: any[]) => any;

export type CachedServerMethod<T extends AnyMethod> = T & {
    cache?: {
        drop(...args: Parameters<T>): Promise<void>;
        stats: CacheStatisticsObject
    }
};

/**
 * The method function with a signature async function(...args, [flags]) where:
 * * ...args - the method function arguments (can be any number of arguments or none).
 * * flags - when caching is enabled, an object used to set optional method result flags:
 * * * ttl - 0 if result is valid but cannot be cached. Defaults to cache policy.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
 */
export type ServerMethod = AnyMethod;

/**
 * The same cache configuration used in server.cache().
 * The generateTimeout option is required.
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servermethodname-method-options)
 * For reference [See docs](https://github.com/hapijs/hapi/blob/master/API.md#-servercacheoptions)
 */
export interface ServerMethodCache extends PolicyOptions<any> {
    generateTimeout: number | false;
    cache?: string;
    segment?: string;
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

interface BaseServerMethods {
    [name: string]: (
        ServerMethod |
        CachedServerMethod<ServerMethod> |
        BaseServerMethods
    );
}

/**
 * An empty interface to allow typings of custom server.methods.
 */
export interface ServerMethods extends BaseServerMethods {
}
